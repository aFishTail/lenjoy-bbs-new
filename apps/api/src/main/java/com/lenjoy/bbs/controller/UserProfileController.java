package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.MyProfileResponse;
import com.lenjoy.bbs.domain.dto.UpdateMyProfileRequest;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users/me")
@RequiredArgsConstructor
public class UserProfileController {

    private final UserProfileService userProfileService;
    private final SecurityAccess securityAccess;

    @GetMapping
    public ApiResponse<MyProfileResponse> myProfile(@AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(userProfileService.getMyProfile(currentUser.getUserId()));
    }

    @PatchMapping
    public ApiResponse<MyProfileResponse> updateMyProfile(
            @Valid @RequestBody UpdateMyProfileRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = securityAccess.requireAuthenticated(principal);
        return ApiResponse.ok(userProfileService.updateMyProfile(currentUser.getUserId(), request));
    }
}
