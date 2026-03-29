package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreateCommentRequest;
import com.lenjoy.bbs.domain.dto.DeleteCommentRequest;
import com.lenjoy.bbs.domain.dto.PostCommentResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.BountyService;
import com.lenjoy.bbs.service.CommentService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class CommentController {

    private final CommentService commentService;
    private final BountyService bountyService;

    @GetMapping("/posts/{postId}/comments")
    public ApiResponse<List<PostCommentResponse>> list(@PathVariable Long postId, Authentication authentication) {
        AuthUserPrincipal principal = tryPrincipal(authentication);
        Long requesterUserId = principal == null ? null : principal.getUserId();
        return ApiResponse.ok(commentService.listByPost(postId, false, requesterUserId));
    }

    @PostMapping("/posts/{postId}/comments")
    public ApiResponse<PostCommentResponse> create(
            @PathVariable Long postId,
            @Valid @RequestBody CreateCommentRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse
                .ok(commentService.create(postId, principal.getUserId(), request.getContent(), request.getParentId()));
    }

    @PostMapping("/posts/{postId}/comments/{commentId}/accept")
    public ApiResponse<PostCommentResponse> accept(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        bountyService.acceptAnswer(postId, commentId, principal.getUserId());
        return ApiResponse.ok(commentService.listByPost(postId, false, principal.getUserId()).stream()
                .filter(comment -> commentId.equals(comment.getId()))
                .findFirst()
                .orElseGet(() -> commentService.listByPost(postId, false, principal.getUserId()).stream()
                        .flatMap(comment -> java.util.stream.Stream.concat(
                                java.util.stream.Stream.of(comment),
                                comment.getReplies().stream()))
                        .filter(comment -> commentId.equals(comment.getId()))
                        .findFirst()
                        .orElseThrow(() -> new ApiException("COMMENT_NOT_FOUND", "评论不存在", HttpStatus.NOT_FOUND))));
    }

    @GetMapping("/admin/bounties")
    public ApiResponse<List<com.lenjoy.bbs.domain.dto.AdminBountySummaryResponse>> adminBounties(
            String status,
            String keyword,
            Authentication authentication) {
        requireAdmin(authentication);
        return ApiResponse.ok(bountyService.listAdminBounties(status, keyword));
    }

    @GetMapping("/admin/bounties/{postId}/comments")
    public ApiResponse<List<PostCommentResponse>> adminComments(@PathVariable Long postId,
            Authentication authentication) {
        AuthUserPrincipal principal = requireAdmin(authentication);
        return ApiResponse.ok(commentService.listByPost(postId, true, principal.getUserId()));
    }

    @DeleteMapping("/posts/{postId}/comments/{commentId}")
    public ApiResponse<Void> deleteOwnComment(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        commentService.deleteByUser(postId, commentId, principal.getUserId());
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/admin/comments/{commentId}")
    public ApiResponse<Void> deleteComment(
            @PathVariable Long commentId,
            @Valid @RequestBody DeleteCommentRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requireAdmin(authentication);
        commentService.deleteByAdmin(commentId, principal.getUserId(), request.getReason());
        return ApiResponse.ok(null);
    }

    private AuthUserPrincipal requirePrincipal(Authentication authentication) {
        AuthUserPrincipal principal = tryPrincipal(authentication);
        if (principal == null) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }

    private AuthUserPrincipal tryPrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            return null;
        }
        return principal;
    }

    private AuthUserPrincipal requireAdmin(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        boolean isAdmin = authentication.getAuthorities() != null
                && authentication.getAuthorities().stream().anyMatch(item -> "ROLE_ADMIN".equals(item.getAuthority()));
        if (!isAdmin) {
            throw new ApiException("FORBIDDEN", "仅管理员可执行该操作", HttpStatus.FORBIDDEN);
        }
        return principal;
    }
}