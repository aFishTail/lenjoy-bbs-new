package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lenjoy.bbs.domain.dto.PageResponse;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.PostSummaryResponse;
import com.lenjoy.bbs.domain.dto.TagResponse;
import com.lenjoy.bbs.domain.entity.CategoryEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.ResourceAppealEntity;
import com.lenjoy.bbs.domain.entity.ResourcePurchaseEntity;
import com.lenjoy.bbs.domain.entity.TagEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.enums.PostStatus;
import com.lenjoy.bbs.domain.enums.PostType;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class PostAssembler {

    private final UserAccountMapper userAccountMapper;
    private final ResourceTradeService resourceTradeService;
    private final InteractionService interactionService;
    private final TaxonomyService taxonomyService;

    public PageResponse<PostSummaryResponse> toPageResponse(Page<PostEntity> page) {
        PageResponse<PostSummaryResponse> response = new PageResponse<>();
        response.setItems(toSummaryList(page.getRecords()));
        response.setPage(page.getCurrent());
        response.setPageSize(page.getSize());
        response.setTotal(page.getTotal());
        response.setTotalPages(page.getPages());
        response.setHasNext(page.getCurrent() < page.getPages());
        response.setHasPrevious(page.getCurrent() > 1);
        return response;
    }

    public List<PostSummaryResponse> toSummaryList(List<PostEntity> posts) {
        if (posts.isEmpty()) {
            return List.of();
        }
        Set<Long> authorIds = posts.stream().map(PostEntity::getAuthorId).collect(Collectors.toSet());
        Map<Long, String> usernameMap = userAccountMapper
                .selectList(new LambdaQueryWrapper<UserAccountEntity>().in(UserAccountEntity::getId, authorIds))
                .stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, UserAccountEntity::getUsername));
        Map<Long, CategoryEntity> categories = taxonomyService.findCategoryMap(
                posts.stream().map(PostEntity::getCategoryId).collect(Collectors.toSet()));
        Map<Long, List<TagEntity>> tagsByPostId = taxonomyService.findTagsByPostIds(
                posts.stream().map(PostEntity::getId).collect(Collectors.toSet()));
        return posts.stream()
                .map(post -> toSummary(post, usernameMap.get(post.getAuthorId()), categories.get(post.getCategoryId()),
                        tagsByPostId.getOrDefault(post.getId(), List.of())))
                .toList();
    }

    public PostDetailResponse toDetail(PostEntity entity, String authorUsername, Long requesterUserId, boolean isAuthor,
            boolean isAdmin) {
        PostDetailResponse response = new PostDetailResponse();
        response.setId(entity.getId());
        response.setPostType(entity.getPostType());
        response.setTitle(entity.getTitle());
        response.setStatus(entity.getStatus());
        response.setAuthorId(entity.getAuthorId());
        response.setAuthorUsername(authorUsername);
        CategoryEntity category = taxonomyService.findCategoryMap(List.of(entity.getCategoryId())).get(entity.getCategoryId());
        response.setCategoryId(entity.getCategoryId());
        response.setCategoryName(category == null ? null : category.getName());
        response.setTags(toTagResponses(taxonomyService.findTagsByPostIds(List.of(entity.getId()))
                .getOrDefault(entity.getId(), List.of())));
        response.setContent(entity.getContent());
        response.setHiddenContent(blankToNull(entity.getHiddenContent()));
        response.setPrice(entity.getPrice());
        response.setBountyAmount(entity.getBountyAmount());
        response.setBountyStatus(entity.getBountyStatus());
        response.setBountyExpireAt(entity.getBountyExpireAt());
        response.setBountySettledAt(entity.getBountySettledAt());
        response.setAcceptedCommentId(entity.getAcceptedCommentId());
        response.setOfflineReason(entity.getOfflineReason());
        response.setOfflinedAt(entity.getOfflinedAt());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());

        PostType postType = PostType.fromNullable(entity.getPostType());
        ResourcePurchaseEntity purchase = postType == PostType.RESOURCE && requesterUserId != null
                ? resourceTradeService.findPurchase(entity.getId(), requesterUserId)
                : null;
        ResourceAppealEntity appeal = purchase == null ? null
                : resourceTradeService.findAppealByPurchaseId(purchase.getId());
        boolean purchased = purchase != null;
        boolean canSeeHidden = postType == PostType.RESOURCE
                && (isAuthor || isAdmin || resourceTradeService.canAccessHiddenContent(entity.getId(), requesterUserId));
        response.setResourceUnlocked(canSeeHidden);
        response.setPurchased(purchased);
        response.setCanPurchase(postType == PostType.RESOURCE
                && !isAuthor
                && !isAdmin
                && requesterUserId != null
                && PostStatus.PUBLISHED.value().equals(entity.getStatus())
                && !purchased);
        response.setPurchaseId(purchase == null ? null : purchase.getId());
        response.setPurchaseStatus(purchase == null ? null : purchase.getStatus());
        response.setRefundedAmount(purchase == null ? 0 : purchase.getRefundedAmount());
        response.setAppealStatus(appeal == null ? null : appeal.getStatus());
        response.setHiddenContent(canSeeHidden ? entity.getHiddenContent() : null);
        response.setLikeCount(countPostLikes(entity.getId()));
        response.setCollectCount(countPostFavorites(entity.getId()));
        response.setCommentCount(countPostComments(entity.getId()));
        response.setLiked(hasPostLiked(entity.getId(), requesterUserId));
        response.setCollected(hasPostFavorited(entity.getId(), requesterUserId));
        return response;
    }

    private PostSummaryResponse toSummary(PostEntity post, String authorUsername, CategoryEntity category,
            List<TagEntity> tags) {
        PostSummaryResponse response = new PostSummaryResponse();
        response.setId(post.getId());
        response.setPostType(post.getPostType());
        response.setTitle(post.getTitle());
        response.setStatus(post.getStatus());
        response.setAuthorId(post.getAuthorId());
        response.setAuthorUsername(authorUsername);
        response.setCategoryId(post.getCategoryId());
        response.setCategoryName(category == null ? null : category.getName());
        response.setTags(toTagResponses(tags));
        response.setLikeCount(countPostLikes(post.getId()));
        response.setCollectCount(countPostFavorites(post.getId()));
        response.setCommentCount(countPostComments(post.getId()));
        response.setLiked(false);
        response.setCollected(false);
        response.setCreatedAt(post.getCreatedAt());
        response.setUpdatedAt(post.getUpdatedAt());
        return response;
    }

    private long countPostLikes(Long postId) {
        return interactionService == null ? 0L : interactionService.countPostLikes(postId);
    }

    private long countPostFavorites(Long postId) {
        return interactionService == null ? 0L : interactionService.countPostFavorites(postId);
    }

    private long countPostComments(Long postId) {
        return interactionService == null ? 0L : interactionService.countPostComments(postId);
    }

    private boolean hasPostLiked(Long postId, Long requesterUserId) {
        return interactionService != null && interactionService.hasPostLiked(postId, requesterUserId);
    }

    private boolean hasPostFavorited(Long postId, Long requesterUserId) {
        return interactionService != null && interactionService.hasPostFavorited(postId, requesterUserId);
    }

    private List<TagResponse> toTagResponses(List<TagEntity> tags) {
        return tags.stream().map(taxonomyService::toTagResponse).toList();
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
