package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.OfflinePostRequest;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.entity.ResourceAppealEntity;
import com.lenjoy.bbs.domain.entity.ResourcePurchaseEntity;
import com.lenjoy.bbs.domain.dto.PostSummaryResponse;
import com.lenjoy.bbs.domain.dto.UpdatePostRequest;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PostService {

    private static final String TYPE_NORMAL = "NORMAL";
    private static final String TYPE_RESOURCE = "RESOURCE";
    private static final String TYPE_BOUNTY = "BOUNTY";

    private static final String STATUS_PUBLISHED = "PUBLISHED";
    private static final String STATUS_CLOSED = "CLOSED";
    private static final String STATUS_OFFLINE = "OFFLINE";
    private static final String STATUS_DELETED = "DELETED";

    private final PostMapper postMapper;
    private final UserAccountMapper userAccountMapper;
    private final ResourceTradeService resourceTradeService;
    private final BountyService bountyService;
    private final InteractionService interactionService;

    @Transactional
    public PostDetailResponse create(Long userId, CreatePostRequest request) {
        UserAccountEntity user = requireUser(userId);
        ensureCanPost(user);
        String postType = normalizeType(request.getPostType());
        validateCreateByType(postType, request);

        PostEntity entity = new PostEntity();
        entity.setAuthorId(userId);
        entity.setPostType(postType);
        entity.setTitle(request.getTitle().trim());
        entity.setContent(blankToNull(request.getContent()));
        entity.setHiddenContent(blankToNull(request.getHiddenContent()));
        entity.setPrice(request.getPrice());
        entity.setBountyAmount(request.getBountyAmount());
        entity.setBountyStatus(TYPE_BOUNTY.equals(postType) ? BountyService.BOUNTY_STATUS_ACTIVE : null);
        entity.setBountyExpireAt(request.getBountyExpireAt());
        entity.setBountySettledAt(null);
        entity.setAcceptedCommentId(null);
        entity.setStatus(STATUS_PUBLISHED);
        entity.setDeleted(false);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.insert(entity);

        bountyService.freezeOnCreate(entity, userId);
        postMapper.updateById(entity);

        return toDetail(entity, user.getUsername(), userId, false, false);
    }

    public List<PostSummaryResponse> listPublic(String postType) {
        LambdaQueryWrapper<PostEntity> query = new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getDeleted, false)
                .in(PostEntity::getStatus, List.of(STATUS_PUBLISHED, STATUS_CLOSED))
                .orderByDesc(PostEntity::getCreatedAt);
        if (postType != null && !postType.isBlank()) {
            query.eq(PostEntity::getPostType, normalizeType(postType));
        }
        List<PostEntity> posts = postMapper.selectList(query);
        return fillAuthorAndMap(posts);
    }

    public List<PostSummaryResponse> listMine(Long userId) {
        List<PostEntity> posts = postMapper.selectList(new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getAuthorId, userId)
                .orderByDesc(PostEntity::getCreatedAt));
        return fillAuthorAndMap(posts);
    }

    public List<PostSummaryResponse> listAdmin(String status, String postType, String authorKeyword) {
        LambdaQueryWrapper<PostEntity> query = new LambdaQueryWrapper<PostEntity>()
                .orderByDesc(PostEntity::getCreatedAt);

        if (status != null && !status.isBlank()) {
            query.eq(PostEntity::getStatus, status.trim().toUpperCase());
        }
        if (postType != null && !postType.isBlank()) {
            query.eq(PostEntity::getPostType, normalizeType(postType));
        }
        if (authorKeyword != null && !authorKeyword.isBlank()) {
            List<UserAccountEntity> users = userAccountMapper.selectList(new LambdaQueryWrapper<UserAccountEntity>()
                    .like(UserAccountEntity::getUsername, authorKeyword.trim()));
            if (users.isEmpty()) {
                return List.of();
            }
            query.in(PostEntity::getAuthorId, users.stream().map(UserAccountEntity::getId).toList());
        }

        List<PostEntity> posts = postMapper.selectList(query);
        return fillAuthorAndMap(posts);
    }

    public PostDetailResponse detail(Long postId, Long requesterUserId, boolean requesterIsAdmin) {
        PostEntity entity = requirePost(postId);
        UserAccountEntity author = requireUser(entity.getAuthorId());
        boolean isAuthor = requesterUserId != null && requesterUserId.equals(entity.getAuthorId());
        if (!canView(entity, isAuthor, requesterIsAdmin)) {
            throw new ApiException("POST_NOT_FOUND", "帖子不存在", HttpStatus.NOT_FOUND);
        }
        return toDetail(entity, author.getUsername(), requesterUserId, isAuthor, requesterIsAdmin);
    }

    @Transactional
    public PostDetailResponse update(Long postId, Long userId, UpdatePostRequest request) {
        PostEntity entity = requirePost(postId);
        ensureAuthor(entity, userId);
        ensureEditable(entity);
        validateUpdateByType(entity.getPostType(), request);

        PostEntity nextState = new PostEntity();
        nextState.setBountyAmount(request.getBountyAmount());
        nextState.setBountyExpireAt(request.getBountyExpireAt());
        bountyService.adjustFreezeOnUpdate(entity, nextState, userId);

        entity.setTitle(request.getTitle().trim());
        entity.setContent(blankToNull(request.getContent()));
        entity.setHiddenContent(blankToNull(request.getHiddenContent()));
        entity.setPrice(request.getPrice());
        entity.setBountyAmount(request.getBountyAmount());
        entity.setBountyExpireAt(request.getBountyExpireAt());
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);

        UserAccountEntity author = requireUser(entity.getAuthorId());
        return toDetail(entity, author.getUsername(), userId, true, false);
    }

    @Transactional
    public void close(Long postId, Long userId) {
        PostEntity entity = requirePost(postId);
        ensureAuthor(entity, userId);
        if (STATUS_OFFLINE.equals(entity.getStatus())) {
            throw new ApiException("POST_OFFLINE", "帖子已被下架，无法关闭", HttpStatus.BAD_REQUEST);
        }
        if (STATUS_DELETED.equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            throw new ApiException("POST_DELETED", "帖子已删除", HttpStatus.BAD_REQUEST);
        }
        bountyService.settleOnCloseOrDelete(entity, userId, "关闭悬赏帖子退回赏金");
        entity.setStatus(STATUS_CLOSED);
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);
    }

    @Transactional
    public void delete(Long postId, Long userId) {
        PostEntity entity = requirePost(postId);
        ensureAuthor(entity, userId);
        if (STATUS_DELETED.equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            return;
        }
        bountyService.settleOnCloseOrDelete(entity, userId, "删除悬赏帖子退回赏金");
        entity.setStatus(STATUS_DELETED);
        entity.setDeleted(true);
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);
    }

    @Transactional
    public void offline(Long postId, Long adminUserId, OfflinePostRequest request) {
        PostEntity entity = requirePost(postId);
        if (STATUS_DELETED.equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            throw new ApiException("POST_DELETED", "帖子已删除", HttpStatus.BAD_REQUEST);
        }
        bountyService.settleOnCloseOrDelete(entity, adminUserId, request.getReason().trim());
        entity.setStatus(STATUS_OFFLINE);
        entity.setOfflineReason(request.getReason().trim());
        entity.setOfflinedAt(LocalDateTime.now());
        entity.setOfflinedBy(adminUserId);
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);
    }

    @Transactional
    public void online(Long postId, Long adminUserId) {
        PostEntity entity = requirePost(postId);
        if (STATUS_DELETED.equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            throw new ApiException("POST_DELETED", "帖子已删除", HttpStatus.BAD_REQUEST);
        }
        if (!STATUS_OFFLINE.equals(entity.getStatus())) {
            throw new ApiException("POST_STATUS_INVALID", "仅下架帖子可执行上架", HttpStatus.BAD_REQUEST);
        }

        entity.setStatus(STATUS_PUBLISHED);
        entity.setOfflineReason(null);
        entity.setOfflinedAt(null);
        entity.setOfflinedBy(null);
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);
    }

    private List<PostSummaryResponse> fillAuthorAndMap(List<PostEntity> posts) {
        if (posts.isEmpty()) {
            return List.of();
        }
        Set<Long> authorIds = posts.stream().map(PostEntity::getAuthorId).collect(Collectors.toSet());
        Map<Long, String> usernameMap = userAccountMapper
                .selectList(new LambdaQueryWrapper<UserAccountEntity>().in(UserAccountEntity::getId, authorIds))
                .stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, UserAccountEntity::getUsername));
        return posts.stream().map(post -> {
            PostSummaryResponse resp = new PostSummaryResponse();
            resp.setId(post.getId());
            resp.setPostType(post.getPostType());
            resp.setTitle(post.getTitle());
            resp.setStatus(post.getStatus());
            resp.setAuthorId(post.getAuthorId());
            resp.setAuthorUsername(usernameMap.get(post.getAuthorId()));
            resp.setLikeCount(safeCountPostLikes(post.getId()));
            resp.setCollectCount(safeCountPostFavorites(post.getId()));
            resp.setCommentCount(safeCountPostComments(post.getId()));
            resp.setLiked(false);
            resp.setCollected(false);
            resp.setCreatedAt(post.getCreatedAt());
            resp.setUpdatedAt(post.getUpdatedAt());
            return resp;
        }).toList();
    }

    private PostDetailResponse toDetail(PostEntity entity, String authorUsername, Long requesterUserId,
            boolean isAuthor,
            boolean isAdmin) {
        PostDetailResponse resp = new PostDetailResponse();
        resp.setId(entity.getId());
        resp.setPostType(entity.getPostType());
        resp.setTitle(entity.getTitle());
        resp.setStatus(entity.getStatus());
        resp.setAuthorId(entity.getAuthorId());
        resp.setAuthorUsername(authorUsername);
        resp.setContent(entity.getContent());
        resp.setHiddenContent(blankToNull(entity.getHiddenContent()));
        resp.setPrice(entity.getPrice());
        resp.setBountyAmount(entity.getBountyAmount());
        resp.setBountyStatus(entity.getBountyStatus());
        resp.setBountyExpireAt(entity.getBountyExpireAt());
        resp.setBountySettledAt(entity.getBountySettledAt());
        resp.setAcceptedCommentId(entity.getAcceptedCommentId());
        resp.setOfflineReason(entity.getOfflineReason());
        resp.setOfflinedAt(entity.getOfflinedAt());
        resp.setCreatedAt(entity.getCreatedAt());
        resp.setUpdatedAt(entity.getUpdatedAt());

        ResourcePurchaseEntity purchase = TYPE_RESOURCE.equals(entity.getPostType()) && requesterUserId != null
                ? resourceTradeService.findPurchase(entity.getId(), requesterUserId)
                : null;
        ResourceAppealEntity appeal = purchase == null ? null
                : resourceTradeService.findAppealByPurchaseId(purchase.getId());
        boolean purchased = purchase != null;
        boolean canSeeHidden = TYPE_RESOURCE.equals(entity.getPostType())
                && (isAuthor || isAdmin
                        || resourceTradeService.canAccessHiddenContent(entity.getId(), requesterUserId));
        resp.setResourceUnlocked(canSeeHidden);
        resp.setPurchased(purchased);
        resp.setCanPurchase(TYPE_RESOURCE.equals(entity.getPostType())
                && !isAuthor
                && !isAdmin
                && requesterUserId != null
                && STATUS_PUBLISHED.equals(entity.getStatus())
                && !purchased);
        resp.setPurchaseId(purchase == null ? null : purchase.getId());
        resp.setPurchaseStatus(purchase == null ? null : purchase.getStatus());
        resp.setRefundedAmount(purchase == null ? 0 : purchase.getRefundedAmount());
        resp.setAppealStatus(appeal == null ? null : appeal.getStatus());
        resp.setHiddenContent(canSeeHidden ? entity.getHiddenContent() : null);
        resp.setLikeCount(safeCountPostLikes(entity.getId()));
        resp.setCollectCount(safeCountPostFavorites(entity.getId()));
        resp.setCommentCount(safeCountPostComments(entity.getId()));
        resp.setLiked(safeHasPostLiked(entity.getId(), requesterUserId));
        resp.setCollected(safeHasPostFavorited(entity.getId(), requesterUserId));
        return resp;
    }

    private long safeCountPostLikes(Long postId) {
        return interactionService == null ? 0L : interactionService.countPostLikes(postId);
    }

    private long safeCountPostFavorites(Long postId) {
        return interactionService == null ? 0L : interactionService.countPostFavorites(postId);
    }

    private long safeCountPostComments(Long postId) {
        return interactionService == null ? 0L : interactionService.countPostComments(postId);
    }

    private boolean safeHasPostLiked(Long postId, Long requesterUserId) {
        return interactionService != null && interactionService.hasPostLiked(postId, requesterUserId);
    }

    private boolean safeHasPostFavorited(Long postId, Long requesterUserId) {
        return interactionService != null && interactionService.hasPostFavorited(postId, requesterUserId);
    }

    private boolean canView(PostEntity entity, boolean isAuthor, boolean isAdmin) {
        if (STATUS_DELETED.equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            return isAdmin;
        }
        if (STATUS_OFFLINE.equals(entity.getStatus())) {
            return isAdmin || isAuthor;
        }
        return true;
    }

    private void ensureEditable(PostEntity entity) {
        if (STATUS_OFFLINE.equals(entity.getStatus())) {
            throw new ApiException("POST_OFFLINE", "帖子已下架，无法编辑", HttpStatus.BAD_REQUEST);
        }
        if (STATUS_DELETED.equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            throw new ApiException("POST_DELETED", "帖子已删除", HttpStatus.BAD_REQUEST);
        }
    }

    private void ensureAuthor(PostEntity entity, Long userId) {
        if (!entity.getAuthorId().equals(userId)) {
            throw new ApiException("FORBIDDEN", "仅作者可执行该操作", HttpStatus.FORBIDDEN);
        }
    }

    private void ensureCanPost(UserAccountEntity user) {
        if ("MUTED".equalsIgnoreCase(user.getStatus())) {
            throw new ApiException("USER_MUTED", "禁言用户不可发帖", HttpStatus.FORBIDDEN);
        }
        if (!"ACTIVE".equalsIgnoreCase(user.getStatus())) {
            throw new ApiException("USER_DISABLED", "账号状态异常，无法发帖", HttpStatus.FORBIDDEN);
        }
    }

    private UserAccountEntity requireUser(Long userId) {
        UserAccountEntity user = userAccountMapper.selectById(userId);
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private PostEntity requirePost(Long postId) {
        PostEntity entity = postMapper.selectById(postId);
        if (entity == null) {
            throw new ApiException("POST_NOT_FOUND", "帖子不存在", HttpStatus.NOT_FOUND);
        }
        return entity;
    }

    private String normalizeType(String postType) {
        if (postType == null || postType.isBlank()) {
            throw new ApiException("POST_TYPE_INVALID", "帖子类型不合法", HttpStatus.BAD_REQUEST);
        }
        String normalized = postType.trim().toUpperCase();
        if (!Set.of(TYPE_NORMAL, TYPE_RESOURCE, TYPE_BOUNTY).contains(normalized)) {
            throw new ApiException("POST_TYPE_INVALID", "帖子类型不合法", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private void validateCreateByType(String postType, CreatePostRequest request) {
        if (TYPE_NORMAL.equals(postType) && isBlank(request.getContent())) {
            throw new ApiException("CONTENT_REQUIRED", "普通帖正文不能为空", HttpStatus.BAD_REQUEST);
        }
        if (TYPE_RESOURCE.equals(postType)) {
            if (isBlank(request.getContent())) {
                throw new ApiException("CONTENT_REQUIRED", "资源帖公开内容不能为空", HttpStatus.BAD_REQUEST);
            }
            if (isBlank(request.getHiddenContent())) {
                throw new ApiException("RESOURCE_CONTENT_REQUIRED", "资源帖隐藏内容不能为空", HttpStatus.BAD_REQUEST);
            }
            if (request.getPrice() == null || request.getPrice() <= 0) {
                throw new ApiException("PRICE_INVALID", "资源帖售价必须大于 0", HttpStatus.BAD_REQUEST);
            }
        }
        if (TYPE_BOUNTY.equals(postType)) {
            if (isBlank(request.getContent())) {
                throw new ApiException("CONTENT_REQUIRED", "悬赏帖正文不能为空", HttpStatus.BAD_REQUEST);
            }
            if (request.getBountyAmount() == null || request.getBountyAmount() <= 0) {
                throw new ApiException("BOUNTY_INVALID", "悬赏金额必须大于 0", HttpStatus.BAD_REQUEST);
            }
            if (request.getBountyExpireAt() == null || !request.getBountyExpireAt().isAfter(LocalDateTime.now())) {
                throw new ApiException("BOUNTY_EXPIRE_INVALID", "悬赏有效期必须晚于当前时间", HttpStatus.BAD_REQUEST);
            }
        }
    }

    private void validateUpdateByType(String postType, UpdatePostRequest request) {
        if (TYPE_NORMAL.equals(postType) && isBlank(request.getContent())) {
            throw new ApiException("CONTENT_REQUIRED", "普通帖正文不能为空", HttpStatus.BAD_REQUEST);
        }
        if (TYPE_RESOURCE.equals(postType)) {
            if (isBlank(request.getContent())) {
                throw new ApiException("CONTENT_REQUIRED", "资源帖公开内容不能为空", HttpStatus.BAD_REQUEST);
            }
            if (isBlank(request.getHiddenContent())) {
                throw new ApiException("RESOURCE_CONTENT_REQUIRED", "资源帖隐藏内容不能为空", HttpStatus.BAD_REQUEST);
            }
            if (request.getPrice() == null || request.getPrice() <= 0) {
                throw new ApiException("PRICE_INVALID", "资源帖售价必须大于 0", HttpStatus.BAD_REQUEST);
            }
        }
        if (TYPE_BOUNTY.equals(postType)) {
            if (isBlank(request.getContent())) {
                throw new ApiException("CONTENT_REQUIRED", "悬赏帖正文不能为空", HttpStatus.BAD_REQUEST);
            }
            if (request.getBountyAmount() == null || request.getBountyAmount() <= 0) {
                throw new ApiException("BOUNTY_INVALID", "悬赏金额必须大于 0", HttpStatus.BAD_REQUEST);
            }
            if (request.getBountyExpireAt() == null || !request.getBountyExpireAt().isAfter(LocalDateTime.now())) {
                throw new ApiException("BOUNTY_EXPIRE_INVALID", "悬赏有效期必须晚于当前时间", HttpStatus.BAD_REQUEST);
            }
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
