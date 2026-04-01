package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.SiteMessageResponse;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.SiteMessageService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final SecurityAccess securityAccess;

    @GetMapping
    public ApiResponse<List<SiteMessageResponse>> listMessages(
            @RequestParam(required = false) Integer limit,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(siteMessageService.listMessages(currentUser.getUserId(), limit));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Integer> unreadCount(@AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(siteMessageService.countUnread(currentUser.getUserId()));
    }

    @PatchMapping("/{messageId}/read")
    public ApiResponse<SiteMessageResponse> markRead(
            @PathVariable Long messageId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(siteMessageService.markRead(currentUser.getUserId(), messageId));
    }

    @PatchMapping("/read-all")
    public ApiResponse<Integer> markAllRead(@AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(siteMessageService.markAllRead(currentUser.getUserId()));
    }
}
