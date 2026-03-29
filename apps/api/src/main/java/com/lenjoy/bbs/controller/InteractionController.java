package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.ToggleFollowResponse;
import com.lenjoy.bbs.domain.dto.ToggleInteractionResponse;
import com.lenjoy.bbs.domain.dto.UserRelationResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.InteractionService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class InteractionController {

    private final InteractionService interactionService;

    @PostMapping("/posts/{postId}/likes/toggle")
    public ApiResponse<ToggleInteractionResponse> togglePostLike(
            @PathVariable Long postId,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(interactionService.togglePostLike(postId, principal.getUserId()));
    }

    @PostMapping("/comments/{commentId}/likes/toggle")
    public ApiResponse<ToggleInteractionResponse> toggleCommentLike(
            @PathVariable Long commentId,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(interactionService.toggleCommentLike(commentId, principal.getUserId()));
    }

    @PostMapping("/posts/{postId}/favorites/toggle")
    public ApiResponse<ToggleInteractionResponse> togglePostFavorite(
            @PathVariable Long postId,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(interactionService.togglePostFavorite(postId, principal.getUserId()));
    }

    @PostMapping("/users/{targetUserId}/follow/toggle")
    public ApiResponse<ToggleFollowResponse> toggleFollow(
            @PathVariable Long targetUserId,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(interactionService.toggleFollow(targetUserId, principal.getUserId()));
    }

    @GetMapping("/users/{userId}/followers")
    public ApiResponse<List<UserRelationResponse>> listFollowers(@PathVariable Long userId) {
        return ApiResponse.ok(interactionService.listFollowers(userId));
    }

    @GetMapping("/users/{userId}/following")
    public ApiResponse<List<UserRelationResponse>> listFollowing(@PathVariable Long userId) {
        return ApiResponse.ok(interactionService.listFollowing(userId));
    }

    @GetMapping("/users/me/followers")
    public ApiResponse<List<UserRelationResponse>> myFollowers(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(interactionService.listFollowers(principal.getUserId()));
    }

    @GetMapping("/users/me/following")
    public ApiResponse<List<UserRelationResponse>> myFollowing(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(interactionService.listFollowing(principal.getUserId()));
    }

    private AuthUserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }
}
