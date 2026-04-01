package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.ToggleFollowResponse;
import com.lenjoy.bbs.domain.dto.ToggleInteractionResponse;
import com.lenjoy.bbs.domain.dto.UserRelationResponse;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.InteractionService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final SecurityAccess securityAccess;

    @PostMapping("/posts/{postId}/likes/toggle")
    public ApiResponse<ToggleInteractionResponse> togglePostLike(
            @PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(interactionService.togglePostLike(postId, currentUser.getUserId()));
    }

    @PostMapping("/comments/{commentId}/likes/toggle")
    public ApiResponse<ToggleInteractionResponse> toggleCommentLike(
            @PathVariable Long commentId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(interactionService.toggleCommentLike(commentId, currentUser.getUserId()));
    }

    @PostMapping("/posts/{postId}/favorites/toggle")
    public ApiResponse<ToggleInteractionResponse> togglePostFavorite(
            @PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(interactionService.togglePostFavorite(postId, currentUser.getUserId()));
    }

    @PostMapping("/users/{targetUserId}/follow/toggle")
    public ApiResponse<ToggleFollowResponse> toggleFollow(
            @PathVariable Long targetUserId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(interactionService.toggleFollow(targetUserId, currentUser.getUserId()));
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
    public ApiResponse<List<UserRelationResponse>> myFollowers(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(interactionService.listFollowers(currentUser.getUserId()));
    }

    @GetMapping("/users/me/following")
    public ApiResponse<List<UserRelationResponse>> myFollowing(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(interactionService.listFollowing(currentUser.getUserId()));
    }
}
