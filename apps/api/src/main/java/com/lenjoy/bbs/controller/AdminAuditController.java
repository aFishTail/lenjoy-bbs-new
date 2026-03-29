package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.ResourceTradeAuditItemResponse;
import com.lenjoy.bbs.domain.dto.WalletLedgerItemResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.AdminAuditService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/audit")
public class AdminAuditController {

    private final AdminAuditService adminAuditService;

    @GetMapping("/wallet-ledger")
    public ApiResponse<List<WalletLedgerItemResponse>> walletLedger(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String bizType,
            @RequestParam(required = false) Integer limit,
            Authentication authentication) {
        requireAdmin(authentication);
        return ApiResponse.ok(adminAuditService.listWalletLedger(userId, bizType, limit));
    }

    @GetMapping("/resource-trades")
    public ApiResponse<List<ResourceTradeAuditItemResponse>> resourceTrades(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long postId,
            @RequestParam(required = false) Integer limit,
            Authentication authentication) {
        requireAdmin(authentication);
        return ApiResponse.ok(adminAuditService.listResourceTrades(userId, postId, limit));
    }

    private AuthUserPrincipal requireAdmin(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        boolean isAdmin = authentication.getAuthorities() != null
                && authentication.getAuthorities().stream().anyMatch(item -> "ROLE_ADMIN".equals(item.getAuthority()));
        if (!isAdmin) {
            throw new ApiException("FORBIDDEN", "仅管理员可执行该操作", HttpStatus.FORBIDDEN);
        }
        return principal;
    }
}
