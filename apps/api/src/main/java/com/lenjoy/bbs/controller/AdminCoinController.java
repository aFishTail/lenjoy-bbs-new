package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.AdminCoinUserSummaryResponse;
import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.UpdateUserCoinsRequest;
import com.lenjoy.bbs.domain.dto.WalletSummaryResponse;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.WalletService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/coins")
@RequiredArgsConstructor
public class AdminCoinController {

    private final WalletService walletService;
    private final SecurityAccess securityAccess;

    @GetMapping("/users")
    public ApiResponse<List<AdminCoinUserSummaryResponse>> listUsers(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(walletService.listAdminWalletUsers(status, keyword));
    }

    @PatchMapping("/users/{userId}")
    public ApiResponse<WalletSummaryResponse> updateUserCoins(
            @PathVariable Long userId,
            @Valid @RequestBody UpdateUserCoinsRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAdmin(principal);
        return ApiResponse.ok(walletService.adjustCoinsByAdmin(userId, currentUser.getUserId(), request));
    }
}
