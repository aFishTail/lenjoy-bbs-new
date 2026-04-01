package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.AdminBountySummaryResponse;
import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreateCommentRequest;
import com.lenjoy.bbs.domain.dto.DeleteCommentRequest;
import com.lenjoy.bbs.domain.dto.PostCommentResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.BountyService;
import com.lenjoy.bbs.service.CommentService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final SecurityAccess securityAccess;

    @GetMapping("/posts/{postId}/comments")
    public ApiResponse<List<PostCommentResponse>> list(@PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        Long requesterUserId = principal == null ? null : principal.getUserId();
        return ApiResponse.ok(commentService.listByPost(postId, false, requesterUserId));
    }

    @PostMapping("/posts/{postId}/comments")
    public ApiResponse<PostCommentResponse> create(
            @PathVariable Long postId,
            @Valid @RequestBody CreateCommentRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(commentService.create(postId, currentUser.getUserId(), request.getContent(),
                request.getParentId()));
    }

    @PostMapping("/posts/{postId}/comments/{commentId}/accept")
    public ApiResponse<PostCommentResponse> accept(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        bountyService.acceptAnswer(postId, commentId, currentUser.getUserId());
        return ApiResponse.ok(commentService.listByPost(postId, false, currentUser.getUserId()).stream()
                .filter(comment -> commentId.equals(comment.getId()))
                .findFirst()
                .orElseGet(() -> commentService.listByPost(postId, false, currentUser.getUserId()).stream()
                        .flatMap(comment -> java.util.stream.Stream.concat(
                                java.util.stream.Stream.of(comment),
                                comment.getReplies().stream()))
                        .filter(comment -> commentId.equals(comment.getId()))
                        .findFirst()
                        .orElseThrow(() -> new ApiException("COMMENT_NOT_FOUND", "评论不存在", HttpStatus.NOT_FOUND))));
    }

    @GetMapping("/admin/bounties")
    public ApiResponse<List<AdminBountySummaryResponse>> adminBounties(
            String status,
            String keyword,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(bountyService.listAdminBounties(status, keyword));
    }

    @GetMapping("/admin/bounties/{postId}/comments")
    public ApiResponse<List<PostCommentResponse>> adminComments(@PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAdmin(principal);
        return ApiResponse.ok(commentService.listByPost(postId, true, currentUser.getUserId()));
    }

    @DeleteMapping("/posts/{postId}/comments/{commentId}")
    public ApiResponse<Void> deleteOwnComment(
            @PathVariable Long postId,
            @PathVariable Long commentId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        commentService.deleteByUser(postId, commentId, currentUser.getUserId());
        return ApiResponse.ok(null);
    }

    @DeleteMapping("/admin/comments/{commentId}")
    public ApiResponse<Void> deleteComment(
            @PathVariable Long commentId,
            @Valid @RequestBody DeleteCommentRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAdmin(principal);
        commentService.deleteByAdmin(commentId, currentUser.getUserId(), request.getReason());
        return ApiResponse.ok(null);
    }
}
