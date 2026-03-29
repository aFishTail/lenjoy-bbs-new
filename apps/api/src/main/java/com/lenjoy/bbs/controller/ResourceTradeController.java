package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreateResourceAppealRequest;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.ResourceAppealResponse;
import com.lenjoy.bbs.domain.dto.ResourcePurchaseSummaryResponse;
import com.lenjoy.bbs.domain.dto.ReviewResourceAppealRequest;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.PostService;
import com.lenjoy.bbs.service.ResourceTradeService;
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
public class ResourceTradeController {

    private final ResourceTradeService resourceTradeService;
    private final PostService postService;

    @PostMapping("/posts/{postId}/purchase")
    public ApiResponse<PostDetailResponse> purchase(@PathVariable Long postId, Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        resourceTradeService.purchase(postId, principal.getUserId());
        return ApiResponse.ok(postService.detail(postId, principal.getUserId(), hasRole(authentication, "ROLE_ADMIN")));
    }

    @GetMapping("/users/me/resource-purchases")
    public ApiResponse<List<ResourcePurchaseSummaryResponse>> myPurchases(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(resourceTradeService.listMyPurchases(principal.getUserId()));
    }

    @GetMapping("/users/me/resource-sales")
    public ApiResponse<List<ResourcePurchaseSummaryResponse>> mySales(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(resourceTradeService.listMySales(principal.getUserId()));
    }

    @PostMapping("/resource-purchases/{purchaseId}/appeal")
    public ApiResponse<ResourceAppealResponse> createAppeal(
            @PathVariable Long purchaseId,
            @Valid @RequestBody CreateResourceAppealRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(resourceTradeService.createAppeal(purchaseId, principal.getUserId(), request));
    }

    @GetMapping("/admin/resource-appeals")
    public ApiResponse<List<ResourceAppealResponse>> listAppeals(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            Authentication authentication) {
        requireAdmin(authentication);
        return ApiResponse.ok(resourceTradeService.listAdminAppeals(status, keyword));
    }

    @PatchMapping("/admin/resource-appeals/{appealId}")
    public ApiResponse<ResourceAppealResponse> reviewAppeal(
            @PathVariable Long appealId,
            @Valid @RequestBody ReviewResourceAppealRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requireAdmin(authentication);
        return ApiResponse.ok(resourceTradeService.reviewAppeal(appealId, principal.getUserId(), request));
    }

    private AuthUserPrincipal requireAdmin(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        if (!hasRole(authentication, "ROLE_ADMIN")) {
            throw new ApiException("FORBIDDEN", "仅管理员可执行该操作", HttpStatus.FORBIDDEN);
        }
        return principal;
    }

    private AuthUserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }

    private boolean hasRole(Authentication authentication, String role) {
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        return authentication.getAuthorities().stream().anyMatch(a -> role.equals(a.getAuthority()));
    }
}