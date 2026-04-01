package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.ResourceTradeAuditItemResponse;
import com.lenjoy.bbs.domain.dto.WalletLedgerItemResponse;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.AdminAuditService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/audit")
public class AdminAuditController {

    private final AdminAuditService adminAuditService;
    private final SecurityAccess securityAccess;

    @GetMapping("/wallet-ledger")
    public ApiResponse<List<WalletLedgerItemResponse>> walletLedger(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) String bizType,
            @RequestParam(required = false) Integer limit,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(adminAuditService.listWalletLedger(userId, bizType, limit));
    }

    @GetMapping("/resource-trades")
    public ApiResponse<List<ResourceTradeAuditItemResponse>> resourceTrades(
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) Long postId,
            @RequestParam(required = false) Integer limit,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(adminAuditService.listResourceTrades(userId, postId, limit));
    }
}
