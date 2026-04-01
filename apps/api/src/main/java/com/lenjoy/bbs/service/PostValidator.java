package com.lenjoy.bbs.service;

import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.UpdatePostRequest;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.enums.PostStatus;
import com.lenjoy.bbs.domain.enums.PostType;
import com.lenjoy.bbs.exception.ApiException;
import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class PostValidator {

    public void ensureCanPost(UserAccountEntity user) {
        if ("MUTED".equalsIgnoreCase(user.getStatus())) {
            throw new ApiException("USER_MUTED", "禁言用户不可发帖", HttpStatus.FORBIDDEN);
        }
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new ApiException("USER_DISABLED", "账号状态异常，无法发帖", HttpStatus.FORBIDDEN);
        }
    }

    public void ensureEditable(PostEntity entity) {
        if (PostStatus.OFFLINE.value().equals(entity.getStatus())) {
            throw new ApiException("POST_OFFLINE", "帖子已下架，无法编辑", HttpStatus.BAD_REQUEST);
        }
        if (PostStatus.DELETED.value().equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            throw new ApiException("POST_DELETED", "帖子已删除", HttpStatus.BAD_REQUEST);
        }
    }

    public void ensureAuthor(PostEntity entity, Long userId) {
        if (!entity.getAuthorId().equals(userId)) {
            throw new ApiException("FORBIDDEN", "仅作者可执行该操作", HttpStatus.FORBIDDEN);
        }
    }

    public boolean canView(PostEntity entity, boolean isAuthor, boolean isAdmin) {
        if (PostStatus.DELETED.value().equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            return isAdmin;
        }
        if (PostStatus.OFFLINE.value().equals(entity.getStatus())) {
            return isAdmin || isAuthor;
        }
        return true;
    }

    public void validateCreate(PostType postType, CreatePostRequest request) {
        validateByType(postType, request.getContent(), request.getHiddenContent(), request.getPrice(),
                request.getBountyAmount(), request.getBountyExpireAt());
    }

    public void validateUpdate(PostType postType, UpdatePostRequest request) {
        validateByType(postType, request.getContent(), request.getHiddenContent(), request.getPrice(),
                request.getBountyAmount(), request.getBountyExpireAt());
    }

    private void validateByType(PostType postType, String content, String hiddenContent, Integer price,
            Integer bountyAmount, LocalDateTime bountyExpireAt) {
        if (postType == PostType.NORMAL && isBlank(content)) {
            throw new ApiException("CONTENT_REQUIRED", "普通帖正文不能为空", HttpStatus.BAD_REQUEST);
        }
        if (postType == PostType.RESOURCE) {
            if (isBlank(content)) {
                throw new ApiException("CONTENT_REQUIRED", "资源帖公开内容不能为空", HttpStatus.BAD_REQUEST);
            }
            if (isBlank(hiddenContent)) {
                throw new ApiException("RESOURCE_CONTENT_REQUIRED", "资源帖隐藏内容不能为空", HttpStatus.BAD_REQUEST);
            }
            if (price == null || price <= 0) {
                throw new ApiException("PRICE_INVALID", "资源帖售价必须大于 0", HttpStatus.BAD_REQUEST);
            }
        }
        if (postType == PostType.BOUNTY) {
            if (isBlank(content)) {
                throw new ApiException("CONTENT_REQUIRED", "悬赏帖正文不能为空", HttpStatus.BAD_REQUEST);
            }
            if (bountyAmount == null || bountyAmount <= 0) {
                throw new ApiException("BOUNTY_INVALID", "悬赏金额必须大于 0", HttpStatus.BAD_REQUEST);
            }
            if (bountyExpireAt == null || !bountyExpireAt.isAfter(LocalDateTime.now())) {
                throw new ApiException("BOUNTY_EXPIRE_INVALID", "悬赏有效期必须晚于当前时间", HttpStatus.BAD_REQUEST);
            }
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
