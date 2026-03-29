package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.lenjoy.bbs.domain.dto.SiteMessageResponse;
import com.lenjoy.bbs.domain.entity.SiteMessageEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.SiteMessageMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SiteMessageService {

    public static final String MESSAGE_TYPE_RESOURCE_PURCHASED_BUYER = "RESOURCE_PURCHASED_BUYER";
    public static final String MESSAGE_TYPE_RESOURCE_PURCHASED_SELLER = "RESOURCE_PURCHASED_SELLER";
    public static final String MESSAGE_TYPE_RESOURCE_APPEAL_SUBMITTED_BUYER = "RESOURCE_APPEAL_SUBMITTED_BUYER";
    public static final String MESSAGE_TYPE_RESOURCE_APPEAL_SUBMITTED_SELLER = "RESOURCE_APPEAL_SUBMITTED_SELLER";
    public static final String MESSAGE_TYPE_RESOURCE_REFUND_APPROVED_BUYER = "RESOURCE_REFUND_APPROVED_BUYER";
    public static final String MESSAGE_TYPE_RESOURCE_REFUND_APPROVED_SELLER = "RESOURCE_REFUND_APPROVED_SELLER";
    public static final String MESSAGE_TYPE_RESOURCE_REFUND_REJECTED_BUYER = "RESOURCE_REFUND_REJECTED_BUYER";
    public static final String MESSAGE_TYPE_RESOURCE_REFUND_REJECTED_SELLER = "RESOURCE_REFUND_REJECTED_SELLER";
    public static final String MESSAGE_TYPE_BOUNTY_ACCEPTED_AUTHOR = "BOUNTY_ACCEPTED_AUTHOR";
    public static final String MESSAGE_TYPE_BOUNTY_ACCEPTED_ANSWERER = "BOUNTY_ACCEPTED_ANSWERER";
    public static final String MESSAGE_TYPE_BOUNTY_REFUNDED_AUTHOR = "BOUNTY_REFUNDED_AUTHOR";
    public static final String MESSAGE_TYPE_POST_LIKED = "POST_LIKED";
    public static final String MESSAGE_TYPE_COMMENT_LIKED = "COMMENT_LIKED";
    public static final String MESSAGE_TYPE_POST_FAVORITED = "POST_FAVORITED";
    public static final String MESSAGE_TYPE_USER_FOLLOWED = "USER_FOLLOWED";
    public static final String MESSAGE_TYPE_POST_COMMENTED = "POST_COMMENTED";
    public static final String MESSAGE_TYPE_COMMENT_REPLIED = "COMMENT_REPLIED";
    public static final String MESSAGE_TYPE_MENTIONED = "MENTIONED";

    private static final String BIZ_TYPE_RESOURCE_TRADE = "RESOURCE_TRADE";
    private static final String BIZ_TYPE_INTERACTION = "INTERACTION";
    private static final String BIZ_TYPE_DISCUSSION = "DISCUSSION";
    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;
    private static final long AGGREGATION_WINDOW_MINUTES = 20;

    private final SiteMessageMapper siteMessageMapper;
    private final UserAccountMapper userAccountMapper;

    @Transactional
    public void createMessage(Long userId,
            String messageType,
            String title,
            String content,
            Long bizId,
            Long relatedPostId,
            Long relatedPurchaseId,
            Long relatedAppealId) {
        createMessage(userId,
                messageType,
                title,
                content,
                BIZ_TYPE_RESOURCE_TRADE,
                bizId,
                relatedPostId,
                relatedPurchaseId,
                relatedAppealId);
    }

    @Transactional
    public void createMessage(Long userId,
            String messageType,
            String title,
            String content,
            String bizType,
            Long bizId,
            Long relatedPostId,
            Long relatedPurchaseId,
            Long relatedAppealId) {
        LocalDateTime now = LocalDateTime.now();
        if (isAggregatableType(messageType)) {
            SiteMessageEntity latest = siteMessageMapper.selectLatestAggregatable(
                    userId,
                    messageType,
                    relatedPostId,
                    now.minusMinutes(AGGREGATION_WINDOW_MINUTES));
            if (latest != null) {
                latest.setTitle(title);
                latest.setContent(mergeAggregatedContent(latest.getContent(), content));
                latest.setUpdatedAt(now);
                siteMessageMapper.updateById(latest);
                return;
            }
        }

        SiteMessageEntity message = new SiteMessageEntity();
        message.setUserId(userId);
        message.setMessageType(messageType);
        message.setTitle(title);
        message.setContent(content);
        message.setBizType(bizType);
        message.setBizId(bizId);
        message.setRelatedPostId(relatedPostId);
        message.setRelatedPurchaseId(relatedPurchaseId);
        message.setRelatedAppealId(relatedAppealId);
        message.setRead(false);
        message.setCreatedAt(now);
        message.setUpdatedAt(now);
        siteMessageMapper.insert(message);
    }

    public List<SiteMessageResponse> listMessages(Long userId, Integer limit) {
        requireUser(userId);
        int resolvedLimit = normalizeLimit(limit);
        List<SiteMessageEntity> messages = siteMessageMapper.selectList(new LambdaQueryWrapper<SiteMessageEntity>()
                .eq(SiteMessageEntity::getUserId, userId)
                .orderByDesc(SiteMessageEntity::getCreatedAt)
                .last("LIMIT " + resolvedLimit));
        return messages.stream().map(this::toResponse).toList();
    }

    public int countUnread(Long userId) {
        requireUser(userId);
        return siteMessageMapper.countUnreadByUserId(userId);
    }

    @Transactional
    public SiteMessageResponse markRead(Long userId, Long messageId) {
        SiteMessageEntity message = requireOwnedMessage(userId, messageId);
        if (!Boolean.TRUE.equals(message.getRead())) {
            LocalDateTime now = LocalDateTime.now();
            message.setRead(true);
            message.setReadAt(now);
            message.setUpdatedAt(now);
            siteMessageMapper.updateById(message);
        }
        return toResponse(message);
    }

    @Transactional
    public int markAllRead(Long userId) {
        requireUser(userId);
        LocalDateTime now = LocalDateTime.now();
        return siteMessageMapper.update(
                null,
                new LambdaUpdateWrapper<SiteMessageEntity>()
                        .eq(SiteMessageEntity::getUserId, userId)
                        .eq(SiteMessageEntity::getRead, false)
                        .set(SiteMessageEntity::getRead, true)
                        .set(SiteMessageEntity::getReadAt, now)
                        .set(SiteMessageEntity::getUpdatedAt, now));
    }

    private SiteMessageResponse toResponse(SiteMessageEntity message) {
        SiteMessageResponse response = new SiteMessageResponse();
        response.setId(message.getId());
        response.setMessageType(message.getMessageType());
        response.setTitle(message.getTitle());
        response.setContent(message.getContent());
        response.setBizType(message.getBizType());
        response.setBizId(message.getBizId());
        response.setRelatedPostId(message.getRelatedPostId());
        response.setRelatedPurchaseId(message.getRelatedPurchaseId());
        response.setRelatedAppealId(message.getRelatedAppealId());
        response.setRead(Boolean.TRUE.equals(message.getRead()));
        response.setReadAt(message.getReadAt());
        response.setCreatedAt(message.getCreatedAt());
        response.setActionUrl(buildActionUrl(message));
        return response;
    }

    private String buildActionUrl(SiteMessageEntity message) {
        String messageType = message.getMessageType();
        if (MESSAGE_TYPE_RESOURCE_PURCHASED_BUYER.equals(messageType) && message.getRelatedPostId() != null) {
            return "/posts/" + message.getRelatedPostId();
        }
        if (MESSAGE_TYPE_RESOURCE_PURCHASED_SELLER.equals(messageType)
                || MESSAGE_TYPE_RESOURCE_APPEAL_SUBMITTED_SELLER.equals(messageType)
                || MESSAGE_TYPE_RESOURCE_REFUND_APPROVED_SELLER.equals(messageType)
                || MESSAGE_TYPE_RESOURCE_REFUND_REJECTED_SELLER.equals(messageType)) {
            return "/my/sales";
        }
        if (MESSAGE_TYPE_BOUNTY_ACCEPTED_AUTHOR.equals(messageType)
                || MESSAGE_TYPE_BOUNTY_ACCEPTED_ANSWERER.equals(messageType)
                || MESSAGE_TYPE_BOUNTY_REFUNDED_AUTHOR.equals(messageType)) {
            return message.getRelatedPostId() == null ? "/my/messages" : "/posts/" + message.getRelatedPostId();
        }
        if (MESSAGE_TYPE_POST_LIKED.equals(messageType)
                || MESSAGE_TYPE_POST_FAVORITED.equals(messageType)
                || MESSAGE_TYPE_POST_COMMENTED.equals(messageType)
                || MESSAGE_TYPE_COMMENT_REPLIED.equals(messageType)
                || MESSAGE_TYPE_MENTIONED.equals(messageType)) {
            return message.getRelatedPostId() == null ? "/my/messages" : "/posts/" + message.getRelatedPostId();
        }
        if (MESSAGE_TYPE_COMMENT_LIKED.equals(messageType)) {
            return message.getRelatedPostId() == null ? "/my/messages" : "/posts/" + message.getRelatedPostId();
        }
        if (MESSAGE_TYPE_USER_FOLLOWED.equals(messageType)) {
            return "/my";
        }
        return "/my/purchases";
    }

    private boolean isAggregatableType(String messageType) {
        return MESSAGE_TYPE_POST_LIKED.equals(messageType)
                || MESSAGE_TYPE_COMMENT_LIKED.equals(messageType)
                || MESSAGE_TYPE_POST_FAVORITED.equals(messageType)
                || MESSAGE_TYPE_USER_FOLLOWED.equals(messageType);
    }

    private String mergeAggregatedContent(String oldContent, String latestContent) {
        if (oldContent == null || oldContent.isBlank()) {
            return latestContent;
        }
        if (oldContent.contains("更多互动")) {
            return oldContent;
        }
        return oldContent + "（含更多互动）";
    }

    public String bizTypeInteraction() {
        return BIZ_TYPE_INTERACTION;
    }

    public String bizTypeDiscussion() {
        return BIZ_TYPE_DISCUSSION;
    }

    private int normalizeLimit(Integer limit) {
        if (limit == null || limit <= 0) {
            return DEFAULT_LIMIT;
        }
        return Math.min(limit, MAX_LIMIT);
    }

    private SiteMessageEntity requireOwnedMessage(Long userId, Long messageId) {
        SiteMessageEntity message = siteMessageMapper.selectById(messageId);
        if (message == null || !message.getUserId().equals(userId)) {
            throw new ApiException("MESSAGE_NOT_FOUND", "消息不存在", HttpStatus.NOT_FOUND);
        }
        return message;
    }

    private UserAccountEntity requireUser(Long userId) {
        UserAccountEntity user = userAccountMapper.selectById(userId);
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        }
        return user;
    }
}