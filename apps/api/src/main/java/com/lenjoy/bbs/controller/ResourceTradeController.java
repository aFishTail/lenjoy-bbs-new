package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreateResourceAppealRequest;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.ResourceAppealResponse;
import com.lenjoy.bbs.domain.dto.ResourcePurchaseSummaryResponse;
import com.lenjoy.bbs.domain.dto.ReviewResourceAppealRequest;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.PostService;
import com.lenjoy.bbs.service.ResourceTradeService;
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
public class ResourceTradeController {

    private final ResourceTradeService resourceTradeService;
    private final PostService postService;
    private final SecurityAccess securityAccess;

    @PostMapping("/posts/{postId}/purchase")
    public ApiResponse<PostDetailResponse> purchase(@PathVariable Long postId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        resourceTradeService.purchase(postId, currentUser.getUserId());
        return ApiResponse.ok(postService.detail(postId, currentUser.getUserId(), securityAccess.isAdmin(currentUser)));
    }

    @GetMapping("/users/me/resource-purchases")
    public ApiResponse<List<ResourcePurchaseSummaryResponse>> myPurchases(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(resourceTradeService.listMyPurchases(currentUser.getUserId()));
    }

    @GetMapping("/users/me/resource-sales")
    public ApiResponse<List<ResourcePurchaseSummaryResponse>> mySales(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(resourceTradeService.listMySales(currentUser.getUserId()));
    }

    @PostMapping("/resource-purchases/{purchaseId}/appeal")
    public ApiResponse<ResourceAppealResponse> createAppeal(
            @PathVariable Long purchaseId,
            @Valid @RequestBody CreateResourceAppealRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(resourceTradeService.createAppeal(purchaseId, currentUser.getUserId(), request));
    }

    @GetMapping("/admin/resource-appeals")
    public ApiResponse<List<ResourceAppealResponse>> listAppeals(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(resourceTradeService.listAdminAppeals(status, keyword));
    }

    @PatchMapping("/admin/resource-appeals/{appealId}")
    public ApiResponse<ResourceAppealResponse> reviewAppeal(
            @PathVariable Long appealId,
            @Valid @RequestBody ReviewResourceAppealRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAdmin(principal);
        return ApiResponse.ok(resourceTradeService.reviewAppeal(appealId, currentUser.getUserId(), request));
    }
}
