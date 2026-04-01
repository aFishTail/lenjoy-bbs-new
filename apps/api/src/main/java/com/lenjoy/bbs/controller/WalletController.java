package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.WalletLedgerItemResponse;
import com.lenjoy.bbs.domain.dto.WalletSummaryResponse;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.WalletService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/me")
@RequiredArgsConstructor
public class WalletController {

    private final WalletService walletService;
    private final SecurityAccess securityAccess;

    @GetMapping("/wallet")
    public ApiResponse<WalletSummaryResponse> wallet(@AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(walletService.getWalletSummary(currentUser.getUserId()));
    }

    @GetMapping("/ledger")
    public ApiResponse<List<WalletLedgerItemResponse>> ledger(
            @RequestParam(required = false) Integer limit,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(walletService.listLedger(currentUser.getUserId(), limit));
    }
}
