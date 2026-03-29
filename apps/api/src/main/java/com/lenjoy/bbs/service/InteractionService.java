package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.ToggleFollowResponse;
import com.lenjoy.bbs.domain.dto.ToggleInteractionResponse;
import com.lenjoy.bbs.domain.dto.UserRelationResponse;
import com.lenjoy.bbs.domain.entity.CommentLikeEntity;
import com.lenjoy.bbs.domain.entity.PostCommentEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.PostFavoriteEntity;
import com.lenjoy.bbs.domain.entity.PostLikeEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.entity.UserFollowEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.CommentLikeMapper;
import com.lenjoy.bbs.mapper.PostCommentMapper;
import com.lenjoy.bbs.mapper.PostFavoriteMapper;
import com.lenjoy.bbs.mapper.PostLikeMapper;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.UserFollowMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class InteractionService {

    private final PostLikeMapper postLikeMapper;
    private final CommentLikeMapper commentLikeMapper;
    private final PostFavoriteMapper postFavoriteMapper;
    private final UserFollowMapper userFollowMapper;
    private final PostMapper postMapper;
    private final PostCommentMapper postCommentMapper;
    private final UserAccountMapper userAccountMapper;
    private final SiteMessageService siteMessageService;

    @Transactional
    public ToggleInteractionResponse togglePostLike(Long postId, Long userId) {
        PostEntity post = requirePost(postId);
        requireUser(userId);
        PostLikeEntity existing = postLikeMapper.selectByPostIdAndUserId(postId, userId);
        boolean active;
        if (existing == null) {
            PostLikeEntity entity = new PostLikeEntity();
            entity.setPostId(postId);
            entity.setUserId(userId);
            entity.setCreatedAt(LocalDateTime.now());
            postLikeMapper.insert(entity);
            active = true;
            notifyPostLiked(post, userId);
        } else {
            postLikeMapper.deleteById(existing.getId());
            active = false;
        }
        ToggleInteractionResponse response = new ToggleInteractionResponse();
        response.setActive(active);
        response.setCount(postLikeMapper.countByPostId(postId));
        return response;
    }

    @Transactional
    public ToggleInteractionResponse toggleCommentLike(Long commentId, Long userId) {
        PostCommentEntity comment = requireComment(commentId);
        requireUser(userId);
        if (Boolean.TRUE.equals(comment.getDeleted())) {
            throw new ApiException("COMMENT_DELETED", "该评论已删除", HttpStatus.BAD_REQUEST);
        }
        CommentLikeEntity existing = commentLikeMapper.selectByCommentIdAndUserId(commentId, userId);
        boolean active;
        if (existing == null) {
            CommentLikeEntity entity = new CommentLikeEntity();
            entity.setCommentId(commentId);
            entity.setUserId(userId);
            entity.setCreatedAt(LocalDateTime.now());
            commentLikeMapper.insert(entity);
            active = true;
            notifyCommentLiked(comment, userId);
        } else {
            commentLikeMapper.deleteById(existing.getId());
            active = false;
        }
        ToggleInteractionResponse response = new ToggleInteractionResponse();
        response.setActive(active);
        response.setCount(commentLikeMapper.countByCommentId(commentId));
        return response;
    }

    @Transactional
    public ToggleInteractionResponse togglePostFavorite(Long postId, Long userId) {
        PostEntity post = requirePost(postId);
        requireUser(userId);
        PostFavoriteEntity existing = postFavoriteMapper.selectByPostIdAndUserId(postId, userId);
        boolean active;
        if (existing == null) {
            PostFavoriteEntity entity = new PostFavoriteEntity();
            entity.setPostId(postId);
            entity.setUserId(userId);
            entity.setCreatedAt(LocalDateTime.now());
            postFavoriteMapper.insert(entity);
            active = true;
            notifyPostFavorited(post, userId);
        } else {
            postFavoriteMapper.deleteById(existing.getId());
            active = false;
        }
        ToggleInteractionResponse response = new ToggleInteractionResponse();
        response.setActive(active);
        response.setCount(postFavoriteMapper.countByPostId(postId));
        return response;
    }

    @Transactional
    public ToggleFollowResponse toggleFollow(Long targetUserId, Long followerUserId) {
        requireUser(targetUserId);
        requireUser(followerUserId);
        if (targetUserId.equals(followerUserId)) {
            throw new ApiException("INVALID_OPERATION", "不可关注自己", HttpStatus.BAD_REQUEST);
        }
        UserFollowEntity existing = userFollowMapper.selectByFollowerAndFollowing(followerUserId, targetUserId);
        boolean following;
        if (existing == null) {
            UserFollowEntity entity = new UserFollowEntity();
            entity.setFollowerId(followerUserId);
            entity.setFollowingId(targetUserId);
            entity.setCreatedAt(LocalDateTime.now());
            userFollowMapper.insert(entity);
            following = true;
            notifyUserFollowed(targetUserId, followerUserId);
        } else {
            userFollowMapper.deleteById(existing.getId());
            following = false;
        }
        ToggleFollowResponse response = new ToggleFollowResponse();
        response.setFollowing(following);
        response.setFollowerCount(userFollowMapper.countFollowersByUserId(targetUserId));
        response.setFollowingCount(userFollowMapper.countFollowingByUserId(followerUserId));
        return response;
    }

    public List<UserRelationResponse> listFollowers(Long userId) {
        requireUser(userId);
        List<UserFollowEntity> follows = userFollowMapper.selectList(new LambdaQueryWrapper<UserFollowEntity>()
                .eq(UserFollowEntity::getFollowingId, userId)
                .orderByDesc(UserFollowEntity::getCreatedAt));
        if (follows.isEmpty()) {
            return List.of();
        }
        Map<Long, UserAccountEntity> userMap = userAccountMapper.selectList(new LambdaQueryWrapper<UserAccountEntity>()
                .in(UserAccountEntity::getId,
                        follows.stream().map(UserFollowEntity::getFollowerId).collect(Collectors.toSet())))
                .stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, item -> item));
        return follows.stream().map(item -> toRelationResponse(userMap.get(item.getFollowerId()), item.getCreatedAt()))
                .toList();
    }

    public List<UserRelationResponse> listFollowing(Long userId) {
        requireUser(userId);
        List<UserFollowEntity> follows = userFollowMapper.selectList(new LambdaQueryWrapper<UserFollowEntity>()
                .eq(UserFollowEntity::getFollowerId, userId)
                .orderByDesc(UserFollowEntity::getCreatedAt));
        if (follows.isEmpty()) {
            return List.of();
        }
        Map<Long, UserAccountEntity> userMap = userAccountMapper.selectList(new LambdaQueryWrapper<UserAccountEntity>()
                .in(UserAccountEntity::getId,
                        follows.stream().map(UserFollowEntity::getFollowingId).collect(Collectors.toSet())))
                .stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, item -> item));
        return follows.stream().map(item -> toRelationResponse(userMap.get(item.getFollowingId()), item.getCreatedAt()))
                .toList();
    }

    public boolean hasPostLiked(Long postId, Long userId) {
        if (userId == null) {
            return false;
        }
        return postLikeMapper.selectByPostIdAndUserId(postId, userId) != null;
    }

    public boolean hasPostFavorited(Long postId, Long userId) {
        if (userId == null) {
            return false;
        }
        return postFavoriteMapper.selectByPostIdAndUserId(postId, userId) != null;
    }

    public boolean hasCommentLiked(Long commentId, Long userId) {
        if (userId == null) {
            return false;
        }
        return commentLikeMapper.selectByCommentIdAndUserId(commentId, userId) != null;
    }

    public boolean hasFollowed(Long followerId, Long followingId) {
        if (followerId == null || followingId == null) {
            return false;
        }
        return userFollowMapper.selectByFollowerAndFollowing(followerId, followingId) != null;
    }

    public long countPostLikes(Long postId) {
        return postLikeMapper.countByPostId(postId);
    }

    public long countPostFavorites(Long postId) {
        return postFavoriteMapper.countByPostId(postId);
    }

    public long countPostComments(Long postId) {
        return postCommentMapper.selectCount(new LambdaQueryWrapper<PostCommentEntity>()
                .eq(PostCommentEntity::getPostId, postId)
                .eq(PostCommentEntity::getDeleted, false));
    }

    public long countCommentLikes(Long commentId) {
        return commentLikeMapper.countByCommentId(commentId);
    }

    public long countFollowers(Long userId) {
        return userFollowMapper.countFollowersByUserId(userId);
    }

    public long countFollowing(Long userId) {
        return userFollowMapper.countFollowingByUserId(userId);
    }

    private void notifyPostLiked(PostEntity post, Long actorId) {
        if (post.getAuthorId().equals(actorId)) {
            return;
        }
        UserAccountEntity actor = requireUser(actorId);
        siteMessageService.createMessage(
                post.getAuthorId(),
                SiteMessageService.MESSAGE_TYPE_POST_LIKED,
                "帖子收到新点赞",
                "用户 " + actor.getUsername() + " 点赞了你的帖子《" + post.getTitle() + "》。",
                siteMessageService.bizTypeInteraction(),
                post.getId(),
                post.getId(),
                null,
                null);
    }

    private void notifyCommentLiked(PostCommentEntity comment, Long actorId) {
        if (comment.getAuthorId().equals(actorId)) {
            return;
        }
        UserAccountEntity actor = requireUser(actorId);
        siteMessageService.createMessage(
                comment.getAuthorId(),
                SiteMessageService.MESSAGE_TYPE_COMMENT_LIKED,
                "评论收到新点赞",
                "用户 " + actor.getUsername() + " 点赞了你的评论。",
                siteMessageService.bizTypeInteraction(),
                comment.getId(),
                comment.getPostId(),
                null,
                null);
    }

    private void notifyPostFavorited(PostEntity post, Long actorId) {
        if (post.getAuthorId().equals(actorId)) {
            return;
        }
        UserAccountEntity actor = requireUser(actorId);
        siteMessageService.createMessage(
                post.getAuthorId(),
                SiteMessageService.MESSAGE_TYPE_POST_FAVORITED,
                "帖子被收藏",
                "用户 " + actor.getUsername() + " 收藏了你的帖子《" + post.getTitle() + "》。",
                siteMessageService.bizTypeInteraction(),
                post.getId(),
                post.getId(),
                null,
                null);
    }

    private void notifyUserFollowed(Long targetUserId, Long actorId) {
        if (targetUserId.equals(actorId)) {
            return;
        }
        UserAccountEntity actor = requireUser(actorId);
        siteMessageService.createMessage(
                targetUserId,
                SiteMessageService.MESSAGE_TYPE_USER_FOLLOWED,
                "你有新的关注者",
                "用户 " + actor.getUsername() + " 关注了你。",
                siteMessageService.bizTypeInteraction(),
                actorId,
                null,
                null,
                null);
    }

    private UserRelationResponse toRelationResponse(UserAccountEntity user, LocalDateTime followedAt) {
        UserRelationResponse response = new UserRelationResponse();
        response.setId(user == null ? null : user.getId());
        response.setUsername(user == null ? null : user.getUsername());
        response.setAvatarUrl(user == null ? null : user.getAvatarUrl());
        response.setFollowedAt(followedAt);
        return response;
    }

    private PostEntity requirePost(Long postId) {
        PostEntity post = postMapper.selectById(postId);
        if (post == null || Boolean.TRUE.equals(post.getDeleted()) || "DELETED".equals(post.getStatus())) {
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
