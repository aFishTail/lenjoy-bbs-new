package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreateReportRequest;
import com.lenjoy.bbs.domain.dto.ReportItemResponse;
import com.lenjoy.bbs.domain.dto.ReviewReportRequest;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.ReportService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final SecurityAccess securityAccess;

    @PostMapping("/posts/{postId}/reports")
    public ApiResponse<ReportItemResponse> reportPost(
            @PathVariable Long postId,
            @Valid @RequestBody CreateReportRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(reportService.createPostReport(postId, currentUser.getUserId(), request));
    }

    @PostMapping("/comments/{commentId}/reports")
    public ApiResponse<ReportItemResponse> reportComment(
            @PathVariable Long commentId,
            @Valid @RequestBody CreateReportRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(reportService.createCommentReport(commentId, currentUser.getUserId(), request));
    }

    @GetMapping("/admin/reports")
    public ApiResponse<List<ReportItemResponse>> adminReports(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) String keyword,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(reportService.listAdminReports(status, targetType, keyword));
    }

    @PatchMapping("/admin/reports/posts/{reportId}")
    public ApiResponse<ReportItemResponse> reviewPostReport(
            @PathVariable Long reportId,
            @Valid @RequestBody ReviewReportRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAdmin(principal);
        return ApiResponse.ok(reportService.reviewPostReport(reportId, currentUser.getUserId(), request));
    }

    @PatchMapping("/admin/reports/comments/{reportId}")
    public ApiResponse<ReportItemResponse> reviewCommentReport(
            @PathVariable Long reportId,
            @Valid @RequestBody ReviewReportRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAdmin(principal);
        return ApiResponse.ok(reportService.reviewCommentReport(reportId, currentUser.getUserId(), request));
    }
}
