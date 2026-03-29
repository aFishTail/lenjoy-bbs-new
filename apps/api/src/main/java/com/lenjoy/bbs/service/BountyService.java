package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.AdminBountySummaryResponse;
import com.lenjoy.bbs.domain.entity.PostCommentEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostCommentMapper;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class BountyService {

    public static final String TYPE_BOUNTY = "BOUNTY";
    public static final String BOUNTY_STATUS_ACTIVE = "ACTIVE";
    public static final String BOUNTY_STATUS_RESOLVED = "RESOLVED";
    public static final String BOUNTY_STATUS_EXPIRED = "EXPIRED";

    private static final String POST_STATUS_PUBLISHED = "PUBLISHED";
    private static final String POST_STATUS_CLOSED = "CLOSED";
    private static final String POST_STATUS_OFFLINE = "OFFLINE";
    private static final String POST_STATUS_DELETED = "DELETED";

    private final PostMapper postMapper;
    private final PostCommentMapper postCommentMapper;
    private final UserAccountMapper userAccountMapper;
    private final WalletService walletService;
    private final SiteMessageService siteMessageService;

    @Transactional
    public void freezeOnCreate(PostEntity post, Long userId) {
        if (!TYPE_BOUNTY.equals(post.getPostType())) {
            return;
        }
        if (post.getBountyAmount() == null || post.getBountyAmount() <= 0) {
            throw new ApiException("BOUNTY_INVALID", "悬赏金额必须大于 0", HttpStatus.BAD_REQUEST);
        }
        if (post.getBountyExpireAt() == null || !post.getBountyExpireAt().isAfter(LocalDateTime.now())) {
            throw new ApiException("BOUNTY_EXPIRE_INVALID", "悬赏有效期必须晚于当前时间", HttpStatus.BAD_REQUEST);
        }

        walletService.freezeCoins(
                userId,
                post.getBountyAmount(),
                "BOUNTY_FREEZE",
                "bounty:freeze:create:" + post.getId(),
                "发布悬赏《" + post.getTitle() + "》冻结赏金",
                null);
        post.setBountyStatus(BOUNTY_STATUS_ACTIVE);
    }

    @Transactional
    public void adjustFreezeOnUpdate(PostEntity existing, PostEntity updated, Long userId) {
        if (!TYPE_BOUNTY.equals(existing.getPostType())) {
            return;
        }
        ensureNotSettled(existing);
        if (updated.getBountyExpireAt() == null || !updated.getBountyExpireAt().isAfter(LocalDateTime.now())) {
            throw new ApiException("BOUNTY_EXPIRE_INVALID", "悬赏有效期必须晚于当前时间", HttpStatus.BAD_REQUEST);
        }

        int currentAmount = safeInt(existing.getBountyAmount());
        int nextAmount = safeInt(updated.getBountyAmount());
        int delta = nextAmount - currentAmount;
        if (delta > 0) {
            walletService.freezeCoins(
                    userId,
                    delta,
                    "BOUNTY_FREEZE_ADJUST",
                    "bounty:freeze:update:increase:" + existing.getId() + ":" + nextAmount,
                    "调整悬赏《" + existing.getTitle() + "》追加赏金",
                    null);
        } else if (delta < 0) {
            walletService.unfreezeCoins(
                    userId,
                    Math.abs(delta),
                    "BOUNTY_REFUND_ADJUST",
                    "bounty:freeze:update:decrease:" + existing.getId() + ":" + nextAmount,
                    "调整悬赏《" + existing.getTitle() + "》退回部分赏金",
                    null);
        }
    }

    @Transactional
    public void settleOnCloseOrDelete(PostEntity post, Long operatorUserId, String reason) {
        if (!TYPE_BOUNTY.equals(post.getPostType()) || !BOUNTY_STATUS_ACTIVE.equals(post.getBountyStatus())) {
            return;
        }
        refundBounty(post, operatorUserId, "BOUNTY_REFUND", "bounty:refund:close:" + post.getId(), reason);
    }

    @Transactional
    public PostCommentEntity acceptAnswer(Long postId, Long commentId, Long authorUserId) {
        PostEntity post = requireBounty(postId);
        ensureActiveOrExpire(post, null);
        if (!post.getAuthorId().equals(authorUserId)) {
            throw new ApiException("FORBIDDEN", "仅发帖人可采纳答案", HttpStatus.FORBIDDEN);
        }

        PostCommentEntity comment = requireComment(commentId);
        if (!comment.getPostId().equals(postId) || comment.getParentId() != null) {
            throw new ApiException("COMMENT_INVALID", "仅一级评论可作为候选答案", HttpStatus.BAD_REQUEST);
        }
        if (Boolean.TRUE.equals(comment.getDeleted())) {
            throw new ApiException("COMMENT_DELETED", "该评论已删除", HttpStatus.BAD_REQUEST);
        }
        if (comment.getAuthorId().equals(authorUserId)) {
            throw new ApiException("INVALID_OPERATION", "不可采纳自己的答案", HttpStatus.BAD_REQUEST);
        }
        if (!BOUNTY_STATUS_ACTIVE.equals(post.getBountyStatus())) {
            throw new ApiException("BOUNTY_STATUS_INVALID", "当前悬赏不可采纳", HttpStatus.BAD_REQUEST);
        }

        int amount = safeInt(post.getBountyAmount());
        walletService.unfreezeCoins(
                authorUserId,
                amount,
                "BOUNTY_UNFREEZE_FOR_AWARD",
                "bounty:award:unfreeze:" + postId,
                "悬赏《" + post.getTitle() + "》结算赏金",
                null);
        walletService.adjustAvailableCoins(
                authorUserId,
                "EXPENSE",
                amount,
                "BOUNTY_AWARD_OUT",
                "bounty:award:expense:" + postId,
                "悬赏《" + post.getTitle() + "》发放赏金",
                null);
        walletService.adjustAvailableCoins(
                comment.getAuthorId(),
                "INCOME",
                amount,
                "BOUNTY_AWARD_IN",
                "bounty:award:income:" + postId,
                "悬赏《" + post.getTitle() + "》被采纳发奖",
                null);

        LocalDateTime now = LocalDateTime.now();
        comment.setAccepted(true);
        comment.setUpdatedAt(now);
        postCommentMapper.updateById(comment);

        post.setAcceptedCommentId(commentId);
        post.setBountyStatus(BOUNTY_STATUS_RESOLVED);
        post.setBountySettledAt(now);
        post.setUpdatedAt(now);
        postMapper.updateById(post);

        UserAccountEntity answerer = requireUser(comment.getAuthorId());
        siteMessageService.createMessage(
                authorUserId,
                SiteMessageService.MESSAGE_TYPE_BOUNTY_ACCEPTED_AUTHOR,
                "悬赏已结算",
                "你已采纳悬赏《" + post.getTitle() + "》的答案，" + amount + " 金币已发放给答主。",
                postId,
                postId,
                null,
                null);
        siteMessageService.createMessage(
                answerer.getId(),
                SiteMessageService.MESSAGE_TYPE_BOUNTY_ACCEPTED_ANSWERER,
                "答案已被采纳",
                "你在悬赏《" + post.getTitle() + "》下的答案已被采纳，获得 " + amount + " 金币。",
                postId,
                postId,
                null,
                null);
        return comment;
    }

    @Transactional
    public void ensureActiveOrExpire(PostEntity post, Long operatorUserId) {
        if (!TYPE_BOUNTY.equals(post.getPostType()) || !BOUNTY_STATUS_ACTIVE.equals(post.getBountyStatus())) {
            return;
        }
        if (post.getBountyExpireAt() != null && !post.getBountyExpireAt().isAfter(LocalDateTime.now())) {
            refundBounty(
                    post,
                    operatorUserId,
                    "BOUNTY_REFUND_TIMEOUT",
                    "bounty:refund:timeout:" + post.getId(),
                    "悬赏超时自动退回");
        }
    }

    @Transactional
    @Scheduled(fixedDelay = 60000)
    public void expireOverdueBounties() {
        List<PostEntity> posts = postMapper.selectList(new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getPostType, TYPE_BOUNTY)
                .eq(PostEntity::getBountyStatus, BOUNTY_STATUS_ACTIVE)
                .lt(PostEntity::getBountyExpireAt, LocalDateTime.now())
                .eq(PostEntity::getDeleted, false));
        for (PostEntity post : posts) {
            refundBounty(post, null, "BOUNTY_REFUND_TIMEOUT", "bounty:refund:timeout:" + post.getId(), "悬赏超时自动退回");
        }
    }

    public List<AdminBountySummaryResponse> listAdminBounties(String status, String keyword) {
        LambdaQueryWrapper<PostEntity> query = new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getPostType, TYPE_BOUNTY)
                .orderByDesc(PostEntity::getCreatedAt);
        if (status != null && !status.isBlank()) {
            query.eq(PostEntity::getBountyStatus, status.trim().toUpperCase());
        }
        if (keyword != null && !keyword.isBlank()) {
            query.like(PostEntity::getTitle, keyword.trim());
        }
        List<PostEntity> posts = postMapper.selectList(query);
        if (posts.isEmpty()) {
            return List.of();
        }
        Map<Long, String> authorMap = userAccountMapper
                .selectList(new LambdaQueryWrapper<UserAccountEntity>().in(UserAccountEntity::getId,
                        posts.stream().map(PostEntity::getAuthorId).collect(Collectors.toSet())))
                .stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, UserAccountEntity::getUsername));
        Map<Long, Long> answerCountMap = postCommentMapper.selectList(new LambdaQueryWrapper<PostCommentEntity>()
                .in(PostCommentEntity::getPostId, posts.stream().map(PostEntity::getId).toList())
                .isNull(PostCommentEntity::getParentId)
                .eq(PostCommentEntity::getDeleted, false)).stream()
                .collect(Collectors.groupingBy(PostCommentEntity::getPostId, Collectors.counting()));

        return posts.stream().map(post -> {
            AdminBountySummaryResponse response = new AdminBountySummaryResponse();
            response.setId(post.getId());
            response.setTitle(post.getTitle());
            response.setAuthorId(post.getAuthorId());
            response.setAuthorUsername(authorMap.get(post.getAuthorId()));
            response.setStatus(post.getStatus());
            response.setBountyStatus(post.getBountyStatus());
            response.setBountyAmount(post.getBountyAmount());
            response.setAnswerCount(answerCountMap.getOrDefault(post.getId(), 0L).intValue());
            response.setAcceptedCommentId(post.getAcceptedCommentId());
            response.setBountyExpireAt(post.getBountyExpireAt());
            response.setBountySettledAt(post.getBountySettledAt());
            response.setCreatedAt(post.getCreatedAt());
            response.setUpdatedAt(post.getUpdatedAt());
            return response;
        }).toList();
    }

    private void refundBounty(PostEntity post, Long operatorUserId, String bizType, String bizKey, String reason) {
        if (!TYPE_BOUNTY.equals(post.getPostType()) || !BOUNTY_STATUS_ACTIVE.equals(post.getBountyStatus())) {
            return;
        }
        walletService.unfreezeCoins(
                post.getAuthorId(),
                safeInt(post.getBountyAmount()),
                bizType,
                bizKey,
                reason,
                operatorUserId);

        LocalDateTime now = LocalDateTime.now();
        post.setBountyStatus(BOUNTY_STATUS_EXPIRED);
        post.setBountySettledAt(now);
        if (POST_STATUS_PUBLISHED.equals(post.getStatus())) {
            post.setStatus(POST_STATUS_CLOSED);
        }
        post.setUpdatedAt(now);
        postMapper.updateById(post);

        siteMessageService.createMessage(
                post.getAuthorId(),
                SiteMessageService.MESSAGE_TYPE_BOUNTY_REFUNDED_AUTHOR,
                "悬赏已退回",
                "悬赏《" + post.getTitle() + "》已结束，冻结的 " + safeInt(post.getBountyAmount()) + " 金币已退回钱包。",
                post.getId(),
                post.getId(),
                null,
                null);
    }

    private void ensureNotSettled(PostEntity post) {
        if (!BOUNTY_STATUS_ACTIVE.equals(post.getBountyStatus())) {
            throw new ApiException("BOUNTY_STATUS_INVALID", "当前悬赏已结束，无法再调整", HttpStatus.BAD_REQUEST);
        }
    }

    public PostEntity requireBounty(Long postId) {
        PostEntity post = postMapper.selectById(postId);
        if (post == null || !TYPE_BOUNTY.equals(post.getPostType())) {
            throw new ApiException("POST_NOT_FOUND", "悬赏帖不存在", HttpStatus.NOT_FOUND);
        }
        if (POST_STATUS_DELETED.equals(post.getStatus()) || Boolean.TRUE.equals(post.getDeleted())) {
            throw new ApiException("POST_NOT_FOUND", "悬赏帖不存在", HttpStatus.NOT_FOUND);
        }
        if (POST_STATUS_OFFLINE.equals(post.getStatus())) {
            throw new ApiException("POST_STATUS_INVALID", "悬赏帖已下架", HttpStatus.BAD_REQUEST);
        }
        return post;
    }

    private PostCommentEntity requireComment(Long commentId) {
        PostCommentEntity comment = postCommentMapper.selectById(commentId);
        if (comment == null) {
            throw new ApiException("COMMENT_NOT_FOUND", "评论不存在", HttpStatus.NOT_FOUND);
        }
        return comment;
    }

    private UserAccountEntity requireUser(Long userId) {
        UserAccountEntity user = userAccountMapper.selectById(userId);
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private int safeInt(Integer value) {
        return value == null ? 0 : value;
    }
}