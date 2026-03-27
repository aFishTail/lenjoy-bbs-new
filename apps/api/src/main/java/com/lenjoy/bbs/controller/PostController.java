package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.OfflinePostRequest;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.PostSummaryResponse;
import com.lenjoy.bbs.domain.dto.UpdatePostRequest;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.PostService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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

    @GetMapping("/posts")
    public ApiResponse<List<PostSummaryResponse>> list(@RequestParam(required = false) String postType) {
        return ApiResponse.ok(postService.listPublic(postType));
    }

    @GetMapping("/posts/mine")
    public ApiResponse<List<PostSummaryResponse>> listMine(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(postService.listMine(principal.getUserId()));
    }

    @GetMapping("/posts/{postId}")
    public ApiResponse<PostDetailResponse> detail(@PathVariable Long postId, Authentication authentication) {
        AuthUserPrincipal principal = tryPrincipal(authentication);
        Long requesterUserId = principal == null ? null : principal.getUserId();
        boolean isAdmin = hasRole(authentication, "ROLE_ADMIN");
        return ApiResponse.ok(postService.detail(postId, requesterUserId, isAdmin));
    }

    @PostMapping("/posts")
    public ApiResponse<PostDetailResponse> create(@Valid @RequestBody CreatePostRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(postService.create(principal.getUserId(), request));
    }

    @PutMapping("/posts/{postId}")
    public ApiResponse<PostDetailResponse> update(@PathVariable Long postId,
            @Valid @RequestBody UpdatePostRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(postService.update(postId, principal.getUserId(), request));
    }

    @PostMapping("/posts/{postId}/close")
    public ApiResponse<Void> close(@PathVariable Long postId, Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        postService.close(postId, principal.getUserId());
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/posts/{postId}")
    public ApiResponse<Void> delete(@PathVariable Long postId, Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        postService.delete(postId, principal.getUserId());
        return ApiResponse.ok(null);
    }

    @GetMapping("/admin/posts")
    public ApiResponse<List<PostSummaryResponse>> listAdmin(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String postType,
            @RequestParam(required = false) String author,
            Authentication authentication) {
        requireAdmin(authentication);
        return ApiResponse.ok(postService.listAdmin(status, postType, author));
    }

    @PatchMapping("/admin/posts/{postId}/offline")
    public ApiResponse<Void> offline(@PathVariable Long postId, @Valid @RequestBody OfflinePostRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requireAdmin(authentication);
        postService.offline(postId, principal.getUserId(), request);
        return ApiResponse.ok(null);
    }

    private AuthUserPrincipal requireAdmin(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        if (!hasRole(authentication, "ROLE_ADMIN")) {
            throw new ApiException("FORBIDDEN", "仅管理员可执行该操作", HttpStatus.FORBIDDEN);
        }
        return principal;
    }

    private AuthUserPrincipal requirePrincipal(Authentication authentication) {
        AuthUserPrincipal principal = tryPrincipal(authentication);
        if (principal == null) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }

    private AuthUserPrincipal tryPrincipal(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            return null;
        }
        if (!(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            return null;
        }
        return principal;
    }

    private boolean hasRole(Authentication authentication, String role) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        return authentication.getAuthorities().stream().anyMatch(a -> role.equals(a.getAuthority()));
    }
}
