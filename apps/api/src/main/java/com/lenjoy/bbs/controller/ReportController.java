package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreateReportRequest;
import com.lenjoy.bbs.domain.dto.ReportItemResponse;
import com.lenjoy.bbs.domain.dto.ReviewReportRequest;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.ReportService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1")
public class ReportController {

    private final ReportService reportService;

    @PostMapping("/posts/{postId}/reports")
    public ApiResponse<ReportItemResponse> reportPost(
            @PathVariable Long postId,
            @Valid @RequestBody CreateReportRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(reportService.createPostReport(postId, principal.getUserId(), request));
    }

    @PostMapping("/comments/{commentId}/reports")
    public ApiResponse<ReportItemResponse> reportComment(
            @PathVariable Long commentId,
            @Valid @RequestBody CreateReportRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(reportService.createCommentReport(commentId, principal.getUserId(), request));
    }

    @GetMapping("/admin/reports")
    public ApiResponse<List<ReportItemResponse>> adminReports(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String keyword,
            Authentication authentication) {
        requireAdmin(authentication);
        return ApiResponse.ok(reportService.listAdminReports(status, targetType, keyword));
    }

    @PatchMapping("/admin/reports/posts/{reportId}")
    public ApiResponse<ReportItemResponse> reviewPostReport(
            @PathVariable Long reportId,
            @Valid @RequestBody ReviewReportRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requireAdmin(authentication);
        return ApiResponse.ok(reportService.reviewPostReport(reportId, principal.getUserId(), request));
    }

    @PatchMapping("/admin/reports/comments/{reportId}")
    public ApiResponse<ReportItemResponse> reviewCommentReport(
            @PathVariable Long reportId,
            @Valid @RequestBody ReviewReportRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requireAdmin(authentication);
        return ApiResponse.ok(reportService.reviewCommentReport(reportId, principal.getUserId(), request));
    }

    private AuthUserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
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
