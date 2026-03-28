package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.MyProfileResponse;
import com.lenjoy.bbs.domain.dto.UpdateMyProfileRequest;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.UserProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
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

    @GetMapping
    public ApiResponse<MyProfileResponse> myProfile(Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(userProfileService.getMyProfile(principal.getUserId()));
    }

    @PatchMapping
    public ApiResponse<MyProfileResponse> updateMyProfile(
            @Valid @RequestBody UpdateMyProfileRequest request,
            Authentication authentication) {
        AuthUserPrincipal principal = requirePrincipal(authentication);
        return ApiResponse.ok(userProfileService.updateMyProfile(principal.getUserId(), request));
    }

    private AuthUserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }
}
