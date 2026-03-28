package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.AdminUserSummaryResponse;
import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.UpdateUserStatusRequest;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.AdminUserService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/users")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public ApiResponse<List<AdminUserSummaryResponse>> listUsers(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            Authentication authentication) {
        requireAdmin(authentication);
        return ApiResponse.ok(adminUserService.listUsers(status, keyword));
    }

    @PatchMapping("/{userId}/status")
    public ApiResponse<Void> updateUserStatus(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserStatusRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requireAdmin(authentication);
        adminUserService.updateUserStatus(userId, principal.getUserId(), request);
        return ApiResponse.ok(null);
    }

    private AuthUserPrincipal requireAdmin(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        if (!(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        boolean isAdmin = authentication.getAuthorities() != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        if (!isAdmin) {
            throw new ApiException("FORBIDDEN", "仅管理员可执行该操作", HttpStatus.FORBIDDEN);
        }
        return principal;
    }
}
