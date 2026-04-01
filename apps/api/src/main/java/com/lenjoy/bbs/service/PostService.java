package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.OfflinePostRequest;
import com.lenjoy.bbs.domain.dto.PageResponse;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.PostSummaryResponse;
import com.lenjoy.bbs.domain.dto.UpdatePostRequest;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.enums.PostStatus;
import com.lenjoy.bbs.domain.enums.PostType;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PostService {

    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final PostMapper postMapper;
    private final UserAccountMapper userAccountMapper;
    private final BountyService bountyService;
    private final PostValidator postValidator;
    private final PostAssembler postAssembler;

    @Transactional
    public PostDetailResponse create(Long userId, CreatePostRequest request) {
        UserAccountEntity user = requireUser(userId);
        postValidator.ensureCanPost(user);
        PostType postType = PostType.fromNullable(request.getPostType());
        postValidator.validateCreate(postType, request);

        PostEntity entity = new PostEntity();
        entity.setAuthorId(userId);
        entity.setPostType(postType.value());
        entity.setTitle(request.getTitle().trim());
        entity.setContent(blankToNull(request.getContent()));
        entity.setHiddenContent(blankToNull(request.getHiddenContent()));
        entity.setPrice(request.getPrice());
        entity.setBountyAmount(request.getBountyAmount());
        entity.setBountyStatus(postType == PostType.BOUNTY ? BountyService.BOUNTY_STATUS_ACTIVE : null);
        entity.setBountyExpireAt(request.getBountyExpireAt());
        entity.setBountySettledAt(null);
        entity.setAcceptedCommentId(null);
        entity.setStatus(PostStatus.PUBLISHED.value());
        entity.setDeleted(false);
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.insert(entity);

        bountyService.freezeOnCreate(entity, userId);
        postMapper.updateById(entity);

        return postAssembler.toDetail(entity, user.getUsername(), userId, true, false);
    }

    public PageResponse<PostSummaryResponse> listPublic(String postType, Integer page, Integer pageSize) {
        Page<PostEntity> result = postMapper.selectPage(
                new Page<>(normalizePage(page), normalizePageSize(pageSize)),
                buildPublicListQuery(postType));
        return postAssembler.toPageResponse(result);
    }

    public PageResponse<PostSummaryResponse> listMine(Long userId, Integer page, Integer pageSize) {
        Page<PostEntity> result = postMapper.selectPage(
                new Page<>(normalizePage(page), normalizePageSize(pageSize)),
                buildMineListQuery(userId));
        return postAssembler.toPageResponse(result);
    }

    public List<PostSummaryResponse> listAdmin(String status, String postType, String authorKeyword) {
        LambdaQueryWrapper<PostEntity> query = new LambdaQueryWrapper<PostEntity>()
                .orderByDesc(PostEntity::getCreatedAt);

        if (status != null && !status.isBlank()) {
            query.eq(PostEntity::getStatus, status.trim().toUpperCase());
        }
        if (postType != null && !postType.isBlank()) {
            query.eq(PostEntity::getPostType, PostType.fromNullable(postType).value());
        }
        if (authorKeyword != null && !authorKeyword.isBlank()) {
            List<UserAccountEntity> users = userAccountMapper.selectList(new LambdaQueryWrapper<UserAccountEntity>()
                    .like(UserAccountEntity::getUsername, authorKeyword.trim()));
            if (users.isEmpty()) {
                return List.of();
            }
            query.in(PostEntity::getAuthorId, users.stream().map(UserAccountEntity::getId).toList());
        }

        return postAssembler.toSummaryList(postMapper.selectList(query));
    }

    public PostDetailResponse detail(Long postId, Long requesterUserId, boolean requesterIsAdmin) {
        PostEntity entity = requirePost(postId);
        UserAccountEntity author = requireUser(entity.getAuthorId());
        boolean isAuthor = requesterUserId != null && requesterUserId.equals(entity.getAuthorId());
        if (!postValidator.canView(entity, isAuthor, requesterIsAdmin)) {
            throw new ApiException("POST_NOT_FOUND", "帖子不存在", HttpStatus.NOT_FOUND);
        }
        return postAssembler.toDetail(entity, author.getUsername(), requesterUserId, isAuthor, requesterIsAdmin);
    }

    @Transactional
    public PostDetailResponse update(Long postId, Long userId, UpdatePostRequest request) {
        PostEntity entity = requirePost(postId);
        postValidator.ensureAuthor(entity, userId);
        postValidator.ensureEditable(entity);
        postValidator.validateUpdate(PostType.fromNullable(entity.getPostType()), request);

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
        return postAssembler.toDetail(entity, author.getUsername(), userId, true, false);
    }

    @Transactional
    public void close(Long postId, Long userId) {
        PostEntity entity = requirePost(postId);
        postValidator.ensureAuthor(entity, userId);
        if (PostStatus.OFFLINE.value().equals(entity.getStatus())) {
            throw new ApiException("POST_OFFLINE", "帖子已被下架，无法关闭", HttpStatus.BAD_REQUEST);
        }
        if (PostStatus.DELETED.value().equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            throw new ApiException("POST_DELETED", "帖子已删除", HttpStatus.BAD_REQUEST);
        }
        bountyService.settleOnCloseOrDelete(entity, userId, "关闭悬赏帖子退回赏金");
        entity.setStatus(PostStatus.CLOSED.value());
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);
    }

    @Transactional
    public void delete(Long postId, Long userId) {
        PostEntity entity = requirePost(postId);
        postValidator.ensureAuthor(entity, userId);
        if (PostStatus.DELETED.value().equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            return;
        }
        bountyService.settleOnCloseOrDelete(entity, userId, "删除悬赏帖子退回赏金");
        entity.setStatus(PostStatus.DELETED.value());
        entity.setDeleted(true);
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);
    }

    @Transactional
    public void offline(Long postId, Long adminUserId, OfflinePostRequest request) {
        PostEntity entity = requirePost(postId);
        if (PostStatus.DELETED.value().equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            throw new ApiException("POST_DELETED", "帖子已删除", HttpStatus.BAD_REQUEST);
        }
        bountyService.settleOnCloseOrDelete(entity, adminUserId, request.getReason().trim());
        entity.setStatus(PostStatus.OFFLINE.value());
        entity.setOfflineReason(request.getReason().trim());
        entity.setOfflinedAt(LocalDateTime.now());
        entity.setOfflinedBy(adminUserId);
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);
    }

    @Transactional
    public void online(Long postId, Long adminUserId) {
        PostEntity entity = requirePost(postId);
        if (PostStatus.DELETED.value().equals(entity.getStatus()) || Boolean.TRUE.equals(entity.getDeleted())) {
            throw new ApiException("POST_DELETED", "帖子已删除", HttpStatus.BAD_REQUEST);
        }
        if (!PostStatus.OFFLINE.value().equals(entity.getStatus())) {
            throw new ApiException("POST_STATUS_INVALID", "仅下架帖子可执行上架", HttpStatus.BAD_REQUEST);
        }

        entity.setStatus(PostStatus.PUBLISHED.value());
        entity.setOfflineReason(null);
        entity.setOfflinedAt(null);
        entity.setOfflinedBy(null);
        entity.setUpdatedAt(LocalDateTime.now());
        postMapper.updateById(entity);
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

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private long normalizePage(Integer page) {
        return page == null || page < 1 ? DEFAULT_PAGE : page;
    }

    private long normalizePageSize(Integer pageSize) {
        if (pageSize == null || pageSize < 1) {
            return DEFAULT_PAGE_SIZE;
        }
        return Math.min(pageSize, MAX_PAGE_SIZE);
    }

    private LambdaQueryWrapper<PostEntity> buildPublicListQuery(String postType) {
        LambdaQueryWrapper<PostEntity> query = new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getDeleted, false)
                .in(PostEntity::getStatus, List.of(PostStatus.PUBLISHED.value(), PostStatus.CLOSED.value()))
                .orderByDesc(PostEntity::getCreatedAt);
        if (postType != null && !postType.isBlank()) {
            query.eq(PostEntity::getPostType, PostType.fromNullable(postType).value());
        }
        return query;
    }

    private LambdaQueryWrapper<PostEntity> buildMineListQuery(Long userId) {
        return new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getAuthorId, userId)
                .orderByDesc(PostEntity::getCreatedAt);
    }
}
