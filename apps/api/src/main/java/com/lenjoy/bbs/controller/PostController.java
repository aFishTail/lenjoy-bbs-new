package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.OfflinePostRequest;
import com.lenjoy.bbs.domain.dto.PageResponse;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.PostSummaryResponse;
import com.lenjoy.bbs.domain.dto.UpdatePostRequest;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.PostService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
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
@RequestMapping("/api/v1")
public class PostController {

    private final PostService postService;
    private final SecurityAccess securityAccess;

    @GetMapping("/posts")
    public ApiResponse<PageResponse<PostSummaryResponse>> list(
            @RequestParam(required = false) String postType,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize) {
        return ApiResponse.ok(postService.listPublic(postType, page, pageSize));
    }

    @GetMapping("/posts/mine")
    public ApiResponse<PageResponse<PostSummaryResponse>> listMine(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false) Integer pageSize,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(postService.listMine(currentUser.getUserId(), page, pageSize));
    }

    @GetMapping("/posts/{postId}")
    public ApiResponse<PostDetailResponse> detail(@PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        Long requesterUserId = principal == null ? null : principal.getUserId();
        boolean isAdmin = securityAccess.isAdmin(principal);
        return ApiResponse.ok(postService.detail(postId, requesterUserId, isAdmin));
    }

    @PostMapping("/posts")
    public ApiResponse<PostDetailResponse> create(@Valid @RequestBody CreatePostRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(postService.create(currentUser.getUserId(), request));
    }

    @PutMapping("/posts/{postId}")
    public ApiResponse<PostDetailResponse> update(@PathVariable Long postId,
            @Valid @RequestBody UpdatePostRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(postService.update(postId, currentUser.getUserId(), request));
    }

    @PostMapping("/posts/{postId}/close")
    public ApiResponse<Void> close(@PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        postService.close(postId, currentUser.getUserId());
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/posts/{postId}")
    public ApiResponse<Void> delete(@PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        postService.delete(postId, currentUser.getUserId());
        return ApiResponse.ok(null);
    }

    @GetMapping("/admin/posts")
    public ApiResponse<List<PostSummaryResponse>> listAdmin(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String postType,
            @RequestParam(required = false) String author,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(postService.listAdmin(status, postType, author));
    }

    @PatchMapping("/admin/posts/{postId}/offline")
    public ApiResponse<Void> offline(@PathVariable Long postId, @Valid @RequestBody OfflinePostRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAdmin(principal);
        postService.offline(postId, currentUser.getUserId(), request);
        return ApiResponse.ok(null);
    }

    @PatchMapping("/admin/posts/{postId}/online")
    public ApiResponse<Void> online(@PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAdmin(principal);
        postService.online(postId, currentUser.getUserId());
        return ApiResponse.ok(null);
    }
}
