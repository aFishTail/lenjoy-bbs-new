package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.UploadImageResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/files")
public class FileController {

    private final FileStorageService fileStorageService;

    @PostMapping("/images")
    public ApiResponse<UploadImageResponse> uploadImage(@RequestParam("file") MultipartFile file,
            Authentication authentication) {
        requirePrincipal(authentication);
        String imageUrl = fileStorageService.uploadImage(file);
        return ApiResponse.ok(new UploadImageResponse(imageUrl));
    }

    private AuthUserPrincipal requirePrincipal(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        if (!(authentication.getPrincipal() instanceof AuthUserPrincipal principal)) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }
}
