package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CreateOpenApiPostRequest;
import com.lenjoy.bbs.domain.dto.OpenApiPostCreateResponse;
import com.lenjoy.bbs.service.OpenApiPostService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/open/v1")
public class OpenApiPostController {

    private final OpenApiPostService openApiPostService;

    @PostMapping("/posts")
    public ApiResponse<OpenApiPostCreateResponse> create(
            @RequestHeader(value = "X-API-Key", required = false) String apiKey,
            @Valid @RequestBody CreateOpenApiPostRequest request) {
        return ApiResponse.ok(openApiPostService.createPost(apiKey, request));
    }
}
