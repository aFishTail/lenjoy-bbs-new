package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.UploadImageResponse;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
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
    private final SecurityAccess securityAccess;

    @PostMapping("/images")
    public ApiResponse<UploadImageResponse> uploadImage(@RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAuthenticated(principal);
        String imageUrl = fileStorageService.uploadImage(file);
        return ApiResponse.ok(new UploadImageResponse(imageUrl));
    }
}
