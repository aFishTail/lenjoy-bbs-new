package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.AdminDashboardMetricsResponse;
import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.AdminMetricsService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/metrics")
public class AdminMetricsController {

    private final AdminMetricsService adminMetricsService;
    private final SecurityAccess securityAccess;

    @GetMapping("/dashboard")
    public ApiResponse<AdminDashboardMetricsResponse> dashboard(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(adminMetricsService.dashboardMetrics());
    }
}
