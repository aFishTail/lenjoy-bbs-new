package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CategoryResponse;
import com.lenjoy.bbs.domain.dto.MergeTagRequest;
import com.lenjoy.bbs.domain.dto.TagResponse;
import com.lenjoy.bbs.domain.dto.UpdateStatusRequest;
import com.lenjoy.bbs.domain.dto.UpsertCategoryRequest;
import com.lenjoy.bbs.domain.dto.UpsertTagRequest;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.TaxonomyService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin")
public class AdminTaxonomyController {

    private final TaxonomyService taxonomyService;
    private final SecurityAccess securityAccess;

    @GetMapping("/categories")
    public ApiResponse<List<CategoryResponse>> listCategories(@RequestParam(required = false) String contentType,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.listAdminCategories(contentType));
    }

    @PostMapping("/categories")
    public ApiResponse<CategoryResponse> createCategory(@Valid @RequestBody UpsertCategoryRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.createCategory(request));
    }

    @PutMapping("/categories/{categoryId}")
    public ApiResponse<CategoryResponse> updateCategory(@PathVariable Long categoryId,
            @Valid @RequestBody UpsertCategoryRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.updateCategory(categoryId, request));
    }

    @PatchMapping("/categories/{categoryId}/status")
    public ApiResponse<CategoryResponse> updateCategoryStatus(@PathVariable Long categoryId,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.updateCategoryStatus(categoryId, request));
    }

    @GetMapping("/tags")
    public ApiResponse<List<TagResponse>> listTags(@RequestParam(required = false) String keyword,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.listAdminTags(keyword));
    }

    @PostMapping("/tags")
    public ApiResponse<TagResponse> createTag(@Valid @RequestBody UpsertTagRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.createTag(request));
    }

    @PutMapping("/tags/{tagId}")
    public ApiResponse<TagResponse> updateTag(@PathVariable Long tagId,
            @Valid @RequestBody UpsertTagRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.updateTag(tagId, request));
    }

    @PatchMapping("/tags/{tagId}/status")
    public ApiResponse<TagResponse> updateTagStatus(@PathVariable Long tagId,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.updateTagStatus(tagId, request));
    }

    @PostMapping("/tags/{tagId}/merge")
    public ApiResponse<TagResponse> mergeTag(@PathVariable Long tagId,
            @Valid @RequestBody MergeTagRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(taxonomyService.mergeTag(tagId, request));
    }
}
