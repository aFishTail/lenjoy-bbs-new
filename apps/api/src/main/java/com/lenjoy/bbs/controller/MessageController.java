package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.SiteMessageResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.SiteMessageService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/me/messages")
@RequiredArgsConstructor
public class MessageController {

    private final SiteMessageService siteMessageService;

    @GetMapping
    public ApiResponse<List<SiteMessageResponse>> listMessages(
            @RequestParam(required = false) Integer limit,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(siteMessageService.listMessages(principal.getUserId(), limit));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Integer> unreadCount(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(siteMessageService.countUnread(principal.getUserId()));
    }

    @PatchMapping("/{messageId}/read")
    public ApiResponse<SiteMessageResponse> markRead(
            @PathVariable Long messageId,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(siteMessageService.markRead(principal.getUserId(), messageId));
    }

    @PatchMapping("/read-all")
    public ApiResponse<Integer> markAllRead(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(siteMessageService.markAllRead(principal.getUserId()));
    }

    private AuthUserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }
}