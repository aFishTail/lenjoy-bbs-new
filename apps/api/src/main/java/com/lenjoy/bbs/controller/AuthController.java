package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.AuthResponse;
import com.lenjoy.bbs.domain.dto.CaptchaMetadataResponse;
import com.lenjoy.bbs.domain.dto.LoginRequest;
import com.lenjoy.bbs.domain.dto.RegisterRequest;
import com.lenjoy.bbs.service.AuthService;
import com.lenjoy.bbs.service.CaptchaService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final CaptchaService captchaService;

    @GetMapping("/captcha")
    public ApiResponse<CaptchaMetadataResponse> captcha(HttpServletRequest request) {
        String basePath = request.getScheme() + "://" + request.getServerName() + ":" + request.getServerPort();
        return ApiResponse.ok(captchaService.createCaptcha(basePath));
    }

    @GetMapping(value = "/captcha/{captchaId}/image", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> captchaImage(@PathVariable String captchaId) {
        byte[] content = captchaService.getCaptchaImage(captchaId);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .contentType(MediaType.IMAGE_PNG)
                .body(content);
    }

    @PostMapping("/register")
    public ApiResponse<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ApiResponse.ok(authService.register(request));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok(authService.login(request));
    }
}