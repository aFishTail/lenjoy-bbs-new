package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.PostCommentResponse;
import com.lenjoy.bbs.domain.entity.PostCommentEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostCommentMapper;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CommentService {

    private static final Pattern MENTION_PATTERN = Pattern.compile("@([A-Za-z0-9_\\-\\u4e00-\\u9fa5]{2,32})");

    private final PostCommentMapper postCommentMapper;
    private final PostMapper postMapper;
    private final UserAccountMapper userAccountMapper;
    private final BountyService bountyService;
    private final InteractionService interactionService;
    private final SiteMessageService siteMessageService;

    public List<PostCommentResponse> listByPost(Long postId, boolean includeDeleted) {
        return listByPost(postId, includeDeleted, null);
    }

    public List<PostCommentResponse> listByPost(Long postId, boolean includeDeleted, Long requesterUserId) {
        List<PostCommentEntity> comments = postCommentMapper.selectList(new LambdaQueryWrapper<PostCommentEntity>()
                .eq(PostCommentEntity::getPostId, postId)
                .orderByAsc(PostCommentEntity::getCreatedAt));
        if (comments.isEmpty()) {
            return List.of();
        }

        Map<Long, String> usernameMap = userAccountMapper.selectList(new LambdaQueryWrapper<UserAccountEntity>()
                .in(UserAccountEntity::getId, comments.stream()
                        .flatMap(comment -> java.util.stream.Stream.of(comment.getAuthorId(),
                                comment.getReplyToUserId()))
                        .filter(id -> id != null)
                        .collect(Collectors.toSet())))
                .stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, UserAccountEntity::getUsername));

        Map<Long, PostCommentResponse> responseById = new LinkedHashMap<>();
        List<PostCommentResponse> roots = new ArrayList<>();
        for (PostCommentEntity comment : comments) {
            if (!includeDeleted && Boolean.TRUE.equals(comment.getDeleted())) {
                continue;
            }
            PostCommentResponse response = toResponse(comment, usernameMap, requesterUserId);
            responseById.put(response.getId(), response);
            if (comment.getParentId() == null) {
                roots.add(response);
            }
        }
        for (PostCommentEntity comment : comments) {
            if (!includeDeleted && Boolean.TRUE.equals(comment.getDeleted())) {
                continue;
            }
            if (comment.getParentId() != null) {
                PostCommentResponse parent = responseById.get(comment.getParentId());
                PostCommentResponse child = responseById.get(comment.getId());
                if (parent != null && child != null) {
                    if (parent.getReplies() == null) {
                        parent.setReplies(new ArrayList<>());
                    }
                    parent.getReplies().add(child);
                }
            }
        }
        return roots;
    }

    @Transactional
    public PostCommentResponse create(Long postId, Long userId, String content, Long parentId) {
        PostEntity post = requirePost(postId);
        UserAccountEntity user = requireUser(userId);
        ensureCanComment(user);
        String normalizedContent = normalizeContent(content);

        PostCommentEntity parent = null;
        if (parentId != null) {
            parent = requireComment(parentId);
            if (!postId.equals(parent.getPostId())) {
                throw new ApiException("COMMENT_PARENT_INVALID", "评论层级不合法", HttpStatus.BAD_REQUEST);
            }
            if (parent.getParentId() != null) {
                throw new ApiException("COMMENT_DEPTH_INVALID", "仅支持回复一级评论", HttpStatus.BAD_REQUEST);
            }
        }

        if (BountyService.TYPE_BOUNTY.equals(post.getPostType())) {
            bountyService.ensureActiveOrExpire(post, null);
            if (!BountyService.BOUNTY_STATUS_ACTIVE.equals(post.getBountyStatus())) {
                throw new ApiException("BOUNTY_STATUS_INVALID", "当前悬赏已结束，无法继续回答", HttpStatus.BAD_REQUEST);
            }
            if (parent == null && post.getAuthorId().equals(userId)) {
                throw new ApiException("INVALID_OPERATION", "发帖人不可提交候选答案", HttpStatus.BAD_REQUEST);
            }
        }

        PostCommentEntity entity = new PostCommentEntity();
        entity.setPostId(postId);
        entity.setAuthorId(userId);
        entity.setParentId(parentId);
        entity.setReplyToUserId(parent == null ? null : parent.getAuthorId());
        entity.setContent(normalizedContent);
        entity.setAccepted(false);
        entity.setDeleted(false);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        postCommentMapper.insert(entity);

        notifyDiscussion(post, user, entity, parent);

        return listByPost(postId, false).stream()
                .flatMap(comment -> java.util.stream.Stream.concat(
                        java.util.stream.Stream.of(comment),
                        comment.getReplies() == null ? java.util.stream.Stream.empty() : comment.getReplies().stream()))
                .filter(item -> entity.getId().equals(item.getId()))
                .findFirst()
                .orElseThrow(() -> new ApiException("COMMENT_NOT_FOUND", "评论不存在", HttpStatus.NOT_FOUND));
    }

    @Transactional
    public void deleteByAdmin(Long commentId, Long adminUserId, String reason) {
        PostCommentEntity comment = requireComment(commentId);
        if (Boolean.TRUE.equals(comment.getDeleted())) {
            return;
        }
        comment.setDeleted(true);
        comment.setDeletedReason(reason.trim());
        comment.setDeletedBy(adminUserId);
        comment.setUpdatedAt(LocalDateTime.now());
        postCommentMapper.updateById(comment);
    }

    @Transactional
    public void deleteByUser(Long postId, Long commentId, Long userId) {
        PostCommentEntity comment = requireComment(commentId);
        if (!postId.equals(comment.getPostId())) {
            throw new ApiException("COMMENT_NOT_FOUND", "评论不存在", HttpStatus.NOT_FOUND);
        }
        if (!comment.getAuthorId().equals(userId)) {
            throw new ApiException("FORBIDDEN", "仅评论作者可删除", HttpStatus.FORBIDDEN);
        }
        if (Boolean.TRUE.equals(comment.getDeleted())) {
            return;
        }
        comment.setDeleted(true);
        comment.setDeletedReason("用户删除");
        comment.setDeletedBy(userId);
        comment.setUpdatedAt(LocalDateTime.now());
        postCommentMapper.updateById(comment);
    }

    private PostCommentResponse toResponse(PostCommentEntity comment, Map<Long, String> usernameMap,
            Long requesterUserId) {
        PostCommentResponse response = new PostCommentResponse();
        response.setId(comment.getId());
        response.setPostId(comment.getPostId());
        response.setAuthorId(comment.getAuthorId());
        response.setAuthorUsername(usernameMap.get(comment.getAuthorId()));
        response.setParentId(comment.getParentId());
        response.setReplyToUserId(comment.getReplyToUserId());
        response.setReplyToUsername(
                comment.getReplyToUserId() == null ? null : usernameMap.get(comment.getReplyToUserId()));
        response.setContent(comment.getContent());
        response.setAccepted(Boolean.TRUE.equals(comment.getAccepted()));
        response.setDeleted(Boolean.TRUE.equals(comment.getDeleted()));
        response.setDeletedReason(comment.getDeletedReason());
        response.setLikeCount(interactionService == null ? 0L : interactionService.countCommentLikes(comment.getId()));
        response.setLiked(
                interactionService != null && interactionService.hasCommentLiked(comment.getId(), requesterUserId));
        response.setCreatedAt(comment.getCreatedAt());
        response.setUpdatedAt(comment.getUpdatedAt());
        response.setReplies(new ArrayList<>());
        return response;
    }

    private void notifyDiscussion(PostEntity post, UserAccountEntity actor, PostCommentEntity comment,
            PostCommentEntity parent) {
        if (siteMessageService == null) {
            return;
        }
        if (parent == null && !post.getAuthorId().equals(actor.getId())) {
            siteMessageService.createMessage(
                    post.getAuthorId(),
                    SiteMessageService.MESSAGE_TYPE_POST_COMMENTED,
                    "帖子收到新评论",
                    "用户 " + actor.getUsername() + " 评论了你的帖子《" + post.getTitle() + "》。",
                    siteMessageService.bizTypeDiscussion(),
                    comment.getId(),
                    post.getId(),
                    null,
                    null);
        }
        if (parent != null && !parent.getAuthorId().equals(actor.getId())) {
            siteMessageService.createMessage(
                    parent.getAuthorId(),
                    SiteMessageService.MESSAGE_TYPE_COMMENT_REPLIED,
                    "评论收到新回复",
                    "用户 " + actor.getUsername() + " 回复了你的评论。",
                    siteMessageService.bizTypeDiscussion(),
                    comment.getId(),
                    post.getId(),
                    null,
                    null);
        }
        for (UserAccountEntity user : extractMentionUsers(comment.getContent())) {
            if (user.getId().equals(actor.getId())) {
                continue;
            }
            if (parent != null && user.getId().equals(parent.getAuthorId())) {
                continue;
            }
            if (user.getId().equals(post.getAuthorId()) && parent == null) {
                continue;
            }
            siteMessageService.createMessage(
                    user.getId(),
                    SiteMessageService.MESSAGE_TYPE_MENTIONED,
                    "你被提及",
                    "用户 " + actor.getUsername() + " 在帖子《" + post.getTitle() + "》中提及了你。",
                    siteMessageService.bizTypeDiscussion(),
                    comment.getId(),
                    post.getId(),
                    null,
                    null);
        }
    }

    private List<UserAccountEntity> extractMentionUsers(String content) {
        if (content == null || content.isBlank()) {
            return List.of();
        }
        Matcher matcher = MENTION_PATTERN.matcher(content);
        Set<String> usernames = new java.util.LinkedHashSet<>();
        while (matcher.find()) {
            usernames.add(matcher.group(1));
        }
        if (usernames.isEmpty()) {
            return List.of();
        }
        return usernames.stream()
                .map(userAccountMapper::selectByUsername)
                .filter(item -> item != null)
                .toList();
    }

    private String normalizeContent(String content) {
        if (content == null || content.trim().isEmpty()) {
            throw new ApiException("COMMENT_CONTENT_REQUIRED", "评论内容不能为空", HttpStatus.BAD_REQUEST);
        }
        return content.trim();
    }

    private void ensureCanComment(UserAccountEntity user) {
        if ("MUTED".equalsIgnoreCase(user.getStatus())) {
            throw new ApiException("USER_MUTED", "禁言用户不可评论", HttpStatus.FORBIDDEN);
        }
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new ApiException("USER_DISABLED", "账号状态异常，无法评论", HttpStatus.FORBIDDEN);
        }
    }

    private PostEntity requirePost(Long postId) {
        PostEntity post = postMapper.selectById(postId);
        if (post == null) {
            throw new ApiException("POST_NOT_FOUND", "帖子不存在", HttpStatus.NOT_FOUND);
        }
        if (Boolean.TRUE.equals(post.getDeleted()) || "DELETED".equals(post.getStatus())) {
            throw new ApiException("POST_NOT_FOUND", "帖子不存在", HttpStatus.NOT_FOUND);
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
}