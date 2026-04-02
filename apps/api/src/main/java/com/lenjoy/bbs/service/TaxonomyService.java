package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.CategoryResponse;
import com.lenjoy.bbs.domain.dto.MergeTagRequest;
import com.lenjoy.bbs.domain.dto.TagResponse;
import com.lenjoy.bbs.domain.dto.UpdateStatusRequest;
import com.lenjoy.bbs.domain.dto.UpsertCategoryRequest;
import com.lenjoy.bbs.domain.dto.UpsertTagRequest;
import com.lenjoy.bbs.domain.entity.CategoryEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.PostTagEntity;
import com.lenjoy.bbs.domain.entity.TagAliasEntity;
import com.lenjoy.bbs.domain.entity.TagEntity;
import com.lenjoy.bbs.domain.enums.PostStatus;
import com.lenjoy.bbs.domain.enums.PostType;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.CategoryMapper;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.PostTagMapper;
import com.lenjoy.bbs.mapper.TagAliasMapper;
import com.lenjoy.bbs.mapper.TagMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TaxonomyService {

    private static final String CATEGORY_STATUS_ACTIVE = "ACTIVE";
    private static final String CATEGORY_STATUS_INACTIVE = "INACTIVE";
    private static final String TAG_STATUS_ACTIVE = "ACTIVE";
    private static final String TAG_STATUS_INACTIVE = "INACTIVE";
    private static final String TAG_STATUS_MERGED = "MERGED";
    private static final int MAX_TAG_COUNT = 5;

    private final CategoryMapper categoryMapper;
    private final TagMapper tagMapper;
    private final PostTagMapper postTagMapper;
    private final TagAliasMapper tagAliasMapper;
    private final PostMapper postMapper;

    public List<CategoryResponse> listPublicCategories(String contentType) {
        PostType postType = PostType.fromNullable(contentType);
        return categoryMapper.selectList(new LambdaQueryWrapper<CategoryEntity>()
                .eq(CategoryEntity::getContentType, postType.value())
                .eq(CategoryEntity::getStatus, CATEGORY_STATUS_ACTIVE)
                .orderByAsc(CategoryEntity::getSort)
                .orderByAsc(CategoryEntity::getId)).stream().map(this::toCategoryResponse).toList();
    }

    public List<TagResponse> listPublicTags(String keyword) {
        LambdaQueryWrapper<TagEntity> query = new LambdaQueryWrapper<TagEntity>()
                .eq(TagEntity::getStatus, TAG_STATUS_ACTIVE)
                .orderByAsc(TagEntity::getName)
                .last("LIMIT 50");
        if (keyword != null && !keyword.isBlank()) {
            query.like(TagEntity::getName, keyword.trim());
        }
        return toTagResponses(tagMapper.selectList(query));
    }

    public List<TagResponse> listHotTags(String contentType, Integer limit) {
        PostType postType = PostType.fromNullable(contentType);
        int resolvedLimit = limit == null || limit < 1 ? 12 : Math.min(limit, 30);
        List<PostEntity> posts = postMapper.selectList(new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getPostType, postType.value())
                .eq(PostEntity::getDeleted, false)
                .in(PostEntity::getStatus, List.of(PostStatus.PUBLISHED.value(), PostStatus.CLOSED.value())));
        if (posts.isEmpty()) {
            return List.of();
        }
        Set<Long> postIds = posts.stream().map(PostEntity::getId).collect(Collectors.toSet());
        List<PostTagEntity> relations = postTagMapper.selectList(new LambdaQueryWrapper<PostTagEntity>()
                .in(PostTagEntity::getPostId, postIds));
        if (relations.isEmpty()) {
            return List.of();
        }
        Map<Long, Long> counts = relations.stream()
                .collect(Collectors.groupingBy(PostTagEntity::getTagId, Collectors.counting()));
        List<TagEntity> tags = tagMapper.selectBatchIds(counts.keySet());
        return tags.stream()
                .filter(tag -> TAG_STATUS_ACTIVE.equals(tag.getStatus()))
                .sorted((left, right) -> Long.compare(counts.getOrDefault(right.getId(), 0L),
                        counts.getOrDefault(left.getId(), 0L)))
                .limit(resolvedLimit)
                .map(tag -> {
                    TagResponse response = toTagResponse(tag);
                    response.setUsageCount(counts.getOrDefault(tag.getId(), 0L));
                    return response;
                })
                .toList();
    }

    public List<CategoryResponse> listAdminCategories(String contentType) {
        LambdaQueryWrapper<CategoryEntity> query = new LambdaQueryWrapper<CategoryEntity>()
                .orderByAsc(CategoryEntity::getContentType)
                .orderByAsc(CategoryEntity::getParentId)
                .orderByAsc(CategoryEntity::getSort)
                .orderByAsc(CategoryEntity::getId);
        if (contentType != null && !contentType.isBlank()) {
            query.eq(CategoryEntity::getContentType, PostType.fromNullable(contentType).value());
        }
        return categoryMapper.selectList(query).stream().map(this::toCategoryResponse).toList();
    }

    public List<TagResponse> listAdminTags(String keyword) {
        LambdaQueryWrapper<TagEntity> query = new LambdaQueryWrapper<TagEntity>().orderByAsc(TagEntity::getName);
        if (keyword != null && !keyword.isBlank()) {
            query.like(TagEntity::getName, keyword.trim());
        }
        return toTagResponses(tagMapper.selectList(query));
    }

    @Transactional
    public CategoryResponse createCategory(UpsertCategoryRequest request) {
        PostType contentType = PostType.fromNullable(request.getContentType());
        ensureCategoryNameAvailable(request.getName(), contentType.value(), null);
        CategoryEntity entity = new CategoryEntity();
        entity.setName(request.getName().trim());
        entity.setSlug(createUniqueCategorySlug(request.getName(), contentType.value(), null));
        entity.setParentId(normalizeParentId(request.getParentId()));
        entity.setContentType(contentType.value());
        entity.setSort(request.getSort() == null ? 0 : request.getSort());
        entity.setStatus(CATEGORY_STATUS_ACTIVE);
        entity.setLeaf(request.getLeaf() == null ? Boolean.TRUE : request.getLeaf());
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        categoryMapper.insert(entity);
        return toCategoryResponse(entity);
    }

    @Transactional
    public CategoryResponse updateCategory(Long categoryId, UpsertCategoryRequest request) {
        CategoryEntity entity = requireCategory(categoryId);
        PostType contentType = PostType.fromNullable(request.getContentType());
        ensureCategoryNameAvailable(request.getName(), contentType.value(), categoryId);
        entity.setName(request.getName().trim());
        entity.setSlug(createUniqueCategorySlug(request.getName(), contentType.value(), categoryId));
        entity.setParentId(normalizeParentId(request.getParentId()));
        entity.setContentType(contentType.value());
        entity.setSort(request.getSort() == null ? 0 : request.getSort());
        entity.setLeaf(request.getLeaf() == null ? Boolean.TRUE : request.getLeaf());
        entity.setUpdatedAt(LocalDateTime.now());
        categoryMapper.updateById(entity);
        return toCategoryResponse(entity);
    }

    @Transactional
    public CategoryResponse updateCategoryStatus(Long categoryId, UpdateStatusRequest request) {
        CategoryEntity entity = requireCategory(categoryId);
        entity.setStatus(normalizeCategoryStatus(request.getStatus()));
        entity.setUpdatedAt(LocalDateTime.now());
        categoryMapper.updateById(entity);
        return toCategoryResponse(entity);
    }

    @Transactional
    public void deleteCategory(Long categoryId) {
        requireCategory(categoryId);
        ensureCategoryHasNoChildren(categoryId);
        ensureCategoryHasNoPosts(categoryId);
        categoryMapper.deleteById(categoryId);
    }

    @Transactional
    public TagResponse createTag(UpsertTagRequest request) {
        ensureTagNameAvailable(request.getName(), null);
        TagEntity entity = new TagEntity();
        entity.setName(request.getName().trim());
        entity.setSlug(createUniqueTagSlug(request.getName(), null));
        entity.setStatus(TAG_STATUS_ACTIVE);
        entity.setSource("SYSTEM");
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        tagMapper.insert(entity);
        return toTagResponse(entity);
    }

    @Transactional
    public TagResponse updateTag(Long tagId, UpsertTagRequest request) {
        TagEntity entity = requireTag(tagId);
        ensureTagNameAvailable(request.getName(), tagId);
        entity.setName(request.getName().trim());
        entity.setSlug(createUniqueTagSlug(request.getName(), tagId));
        entity.setUpdatedAt(LocalDateTime.now());
        tagMapper.updateById(entity);
        return toTagResponse(entity);
    }

    @Transactional
    public TagResponse updateTagStatus(Long tagId, UpdateStatusRequest request) {
        TagEntity entity = requireTag(tagId);
        entity.setStatus(normalizeTagStatus(request.getStatus(), false));
        entity.setUpdatedAt(LocalDateTime.now());
        tagMapper.updateById(entity);
        return toTagResponse(entity);
    }

    @Transactional
    public void deleteTag(Long tagId) {
        requireTag(tagId);
        ensureTagHasNoPosts(tagId);
        tagMapper.deleteById(tagId);
    }

    @Transactional
    public TagResponse mergeTag(Long tagId, MergeTagRequest request) {
        TagEntity source = requireTag(tagId);
        TagEntity target = requireTag(request.getTargetTagId());
        if (Objects.equals(source.getId(), target.getId())) {
            throw new ApiException("TAG_MERGE_INVALID", "Source and target tags must be different", HttpStatus.BAD_REQUEST);
        }
        List<PostTagEntity> sourceRelations = postTagMapper.selectList(new LambdaQueryWrapper<PostTagEntity>()
                .eq(PostTagEntity::getTagId, source.getId()));
        Set<Long> targetPostIds = postTagMapper.selectList(new LambdaQueryWrapper<PostTagEntity>()
                .eq(PostTagEntity::getTagId, target.getId())).stream()
                .map(PostTagEntity::getPostId)
                .collect(Collectors.toSet());
        for (PostTagEntity relation : sourceRelations) {
            if (targetPostIds.contains(relation.getPostId())) {
                postTagMapper.deleteById(relation.getId());
            } else {
                relation.setTagId(target.getId());
                postTagMapper.updateById(relation);
            }
        }
        String aliasKey = normalizeName(source.getName());
        TagAliasEntity existingAlias = tagAliasMapper.selectOne(new LambdaQueryWrapper<TagAliasEntity>()
                .eq(TagAliasEntity::getNormalizedAlias, aliasKey));
        if (existingAlias == null) {
            TagAliasEntity alias = new TagAliasEntity();
            alias.setTagId(target.getId());
            alias.setAliasName(source.getName());
            alias.setNormalizedAlias(aliasKey);
            alias.setCreatedAt(LocalDateTime.now());
            alias.setUpdatedAt(LocalDateTime.now());
            tagAliasMapper.insert(alias);
        }
        source.setStatus(TAG_STATUS_MERGED);
        source.setUpdatedAt(LocalDateTime.now());
        tagMapper.updateById(source);
        return toTagResponse(target);
    }

    public CategoryEntity requireActiveCategoryForPost(String postType, Long categoryId) {
        if (categoryId == null) {
            throw new ApiException("CATEGORY_REQUIRED", "Category is required", HttpStatus.BAD_REQUEST);
        }
        CategoryEntity category = requireCategory(categoryId);
        if (!CATEGORY_STATUS_ACTIVE.equals(category.getStatus())) {
            throw new ApiException("CATEGORY_DISABLED", "Category is inactive", HttpStatus.BAD_REQUEST);
        }
        if (!PostType.fromNullable(postType).value().equals(category.getContentType())) {
            throw new ApiException("CATEGORY_TYPE_INVALID", "Category does not match post type", HttpStatus.BAD_REQUEST);
        }
        return category;
    }

    public List<TagEntity> requireActiveTags(List<Long> tagIds) {
        if (tagIds == null || tagIds.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<Long> uniqueIds = tagIds.stream().filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (uniqueIds.size() > MAX_TAG_COUNT) {
            throw new ApiException("TAG_LIMIT_EXCEEDED", "At most 5 tags are allowed", HttpStatus.BAD_REQUEST);
        }
        List<TagEntity> tags = tagMapper.selectBatchIds(uniqueIds);
        if (tags.size() != uniqueIds.size()) {
            throw new ApiException("TAG_NOT_FOUND", "Some tags do not exist", HttpStatus.BAD_REQUEST);
        }
        if (tags.stream().anyMatch(tag -> !TAG_STATUS_ACTIVE.equals(tag.getStatus()))) {
            throw new ApiException("TAG_DISABLED", "Inactive tags cannot be used", HttpStatus.BAD_REQUEST);
        }
        return tags;
    }

    public Map<Long, CategoryEntity> findCategoryMap(Collection<Long> categoryIds) {
        Set<Long> ids = categoryIds == null ? Set.of() : categoryIds.stream().filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return categoryMapper.selectBatchIds(ids).stream()
                .collect(Collectors.toMap(CategoryEntity::getId, item -> item));
    }

    public Map<Long, List<TagEntity>> findTagsByPostIds(Collection<Long> postIds) {
        Set<Long> ids = postIds == null ? Set.of() : postIds.stream().filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<PostTagEntity> relations = postTagMapper.selectList(new LambdaQueryWrapper<PostTagEntity>()
                .in(PostTagEntity::getPostId, ids));
        if (relations.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<Long, TagEntity> tagMap = tagMapper.selectBatchIds(relations.stream().map(PostTagEntity::getTagId)
                .collect(Collectors.toSet())).stream()
                .collect(Collectors.toMap(TagEntity::getId, item -> item));
        Map<Long, List<TagEntity>> result = new LinkedHashMap<>();
        for (PostTagEntity relation : relations) {
            TagEntity tag = tagMap.get(relation.getTagId());
            if (tag == null) {
                continue;
            }
            result.computeIfAbsent(relation.getPostId(), key -> new ArrayList<>()).add(tag);
        }
        return result;
    }

    public Map<Long, Set<Long>> findPostIdsByTagIds(Collection<Long> tagIds) {
        Set<Long> ids = tagIds == null ? Set.of() : tagIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        return postTagMapper.selectList(new LambdaQueryWrapper<PostTagEntity>().in(PostTagEntity::getTagId, ids)).stream()
                .collect(Collectors.groupingBy(PostTagEntity::getTagId,
                        Collectors.mapping(PostTagEntity::getPostId, Collectors.toSet())));
    }

    @Transactional
    public void replacePostTags(Long postId, List<Long> tagIds) {
        postTagMapper.delete(new LambdaQueryWrapper<PostTagEntity>().eq(PostTagEntity::getPostId, postId));
        List<TagEntity> tags = requireActiveTags(tagIds);
        for (TagEntity tag : tags) {
            PostTagEntity relation = new PostTagEntity();
            relation.setPostId(postId);
            relation.setTagId(tag.getId());
            relation.setCreatedAt(LocalDateTime.now());
            postTagMapper.insert(relation);
        }
    }

    public TagResponse toTagResponse(TagEntity entity) {
        TagResponse response = new TagResponse();
        response.setId(entity.getId());
        response.setName(entity.getName());
        response.setSlug(entity.getSlug());
        response.setStatus(entity.getStatus());
        response.setSource(entity.getSource());
        response.setUsageCount(postTagMapper.selectCount(new LambdaQueryWrapper<PostTagEntity>()
                .eq(PostTagEntity::getTagId, entity.getId())));
        return response;
    }

    private List<TagResponse> toTagResponses(List<TagEntity> tags) {
        return tags.stream().map(this::toTagResponse).toList();
    }

    private CategoryResponse toCategoryResponse(CategoryEntity entity) {
        CategoryResponse response = new CategoryResponse();
        response.setId(entity.getId());
        response.setName(entity.getName());
        response.setSlug(entity.getSlug());
        response.setParentId(entity.getParentId());
        response.setContentType(entity.getContentType());
        response.setSort(entity.getSort());
        response.setStatus(entity.getStatus());
        response.setLeaf(entity.getLeaf());
        return response;
    }

    private CategoryEntity requireCategory(Long categoryId) {
        CategoryEntity entity = categoryMapper.selectById(categoryId);
        if (entity == null) {
            throw new ApiException("CATEGORY_NOT_FOUND", "Category not found", HttpStatus.NOT_FOUND);
        }
        return entity;
    }

    private TagEntity requireTag(Long tagId) {
        TagEntity entity = tagMapper.selectById(tagId);
        if (entity == null) {
            throw new ApiException("TAG_NOT_FOUND", "Tag not found", HttpStatus.NOT_FOUND);
        }
        return entity;
    }

    private void ensureCategoryHasNoChildren(Long categoryId) {
        Long childCount = categoryMapper.selectCount(new LambdaQueryWrapper<CategoryEntity>()
                .eq(CategoryEntity::getParentId, categoryId));
        if (childCount != null && childCount > 0) {
            throw new ApiException("CATEGORY_HAS_CHILDREN", "Category has child categories and cannot be deleted",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void ensureCategoryHasNoPosts(Long categoryId) {
        Long postCount = postMapper.selectCount(new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getCategoryId, categoryId)
                .eq(PostEntity::getDeleted, false));
        if (postCount != null && postCount > 0) {
            throw new ApiException("CATEGORY_IN_USE", "Category is in use by posts and cannot be deleted",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void ensureTagHasNoPosts(Long tagId) {
        Long relationCount = postTagMapper.selectCount(new LambdaQueryWrapper<PostTagEntity>()
                .eq(PostTagEntity::getTagId, tagId));
        if (relationCount != null && relationCount > 0) {
            throw new ApiException("TAG_IN_USE", "Tag is in use by posts and cannot be deleted",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void ensureCategoryNameAvailable(String name, String contentType, Long currentId) {
        String normalized = normalizeName(name);
        boolean conflict = categoryMapper.selectList(new LambdaQueryWrapper<CategoryEntity>()
                .eq(CategoryEntity::getContentType, contentType)).stream()
                .anyMatch(item -> !Objects.equals(item.getId(), currentId)
                        && normalizeName(item.getName()).equals(normalized));
        if (conflict) {
            throw new ApiException("CATEGORY_DUPLICATED", "Category already exists", HttpStatus.BAD_REQUEST);
        }
    }

    private void ensureTagNameAvailable(String name, Long currentId) {
        String normalized = normalizeName(name);
        boolean conflict = tagMapper.selectList(new LambdaQueryWrapper<TagEntity>()).stream()
                .anyMatch(item -> !Objects.equals(item.getId(), currentId)
                        && normalizeName(item.getName()).equals(normalized));
        if (conflict) {
            throw new ApiException("TAG_DUPLICATED", "Tag already exists", HttpStatus.BAD_REQUEST);
        }
        TagAliasEntity alias = tagAliasMapper.selectOne(new LambdaQueryWrapper<TagAliasEntity>()
                .eq(TagAliasEntity::getNormalizedAlias, normalized));
        if (alias != null && !Objects.equals(alias.getTagId(), currentId)) {
            throw new ApiException("TAG_DUPLICATED", "Tag conflicts with an alias", HttpStatus.BAD_REQUEST);
        }
    }

    private Long normalizeParentId(Long parentId) {
        return parentId == null || parentId < 0 ? 0L : parentId;
    }

    private String normalizeCategoryStatus(String status) {
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (!CATEGORY_STATUS_ACTIVE.equals(normalized) && !CATEGORY_STATUS_INACTIVE.equals(normalized)) {
            throw new ApiException("CATEGORY_STATUS_INVALID", "Invalid category status", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeTagStatus(String status, boolean allowMerged) {
        String normalized = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        if (TAG_STATUS_ACTIVE.equals(normalized) || TAG_STATUS_INACTIVE.equals(normalized)) {
            return normalized;
        }
        if (allowMerged && TAG_STATUS_MERGED.equals(normalized)) {
            return normalized;
        }
        throw new ApiException("TAG_STATUS_INVALID", "Invalid tag status", HttpStatus.BAD_REQUEST);
    }

    private String createUniqueCategorySlug(String name, String contentType, Long currentId) {
        return createUniqueSlug(name, slug -> categoryMapper.selectList(new LambdaQueryWrapper<CategoryEntity>()
                .eq(CategoryEntity::getContentType, contentType)
                .eq(CategoryEntity::getSlug, slug)).stream()
                .anyMatch(item -> !Objects.equals(item.getId(), currentId)));
    }

    private String createUniqueTagSlug(String name, Long currentId) {
        return createUniqueSlug(name, slug -> tagMapper.selectList(new LambdaQueryWrapper<TagEntity>()
                .eq(TagEntity::getSlug, slug)).stream()
                .anyMatch(item -> !Objects.equals(item.getId(), currentId)));
    }

    private String createUniqueSlug(String name, Predicate<String> conflictChecker) {
        String base = normalizeSlug(name);
        String candidate = base;
        int index = 2;
        while (conflictChecker.test(candidate)) {
            candidate = base + "-" + index;
            index++;
        }
        return candidate;
    }

    private String normalizeSlug(String value) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\p{IsHan}]+", "-")
                .replaceAll("(^-+|-+$)", "")
                .replaceAll("-{2,}", "-");
        return normalized.isBlank() ? "item" : normalized;
    }

    private String normalizeName(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
    }
}
