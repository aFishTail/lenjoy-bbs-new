package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.CategoryResponse;
import com.lenjoy.bbs.domain.dto.TagResponse;
import com.lenjoy.bbs.service.TaxonomyService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/taxonomy")
public class TaxonomyController {

    private final TaxonomyService taxonomyService;

    @GetMapping("/categories")
    public ApiResponse<List<CategoryResponse>> listCategories(@RequestParam String contentType) {
        return ApiResponse.ok(taxonomyService.listPublicCategories(contentType));
    }

    @GetMapping("/tags")
    public ApiResponse<List<TagResponse>> listTags(@RequestParam(required = false) String keyword) {
        return ApiResponse.ok(taxonomyService.listPublicTags(keyword));
    }

    @GetMapping("/tags/hot")
    public ApiResponse<List<TagResponse>> listHotTags(@RequestParam String contentType,
            @RequestParam(required = false) Integer limit) {
        return ApiResponse.ok(taxonomyService.listHotTags(contentType, limit));
    }
}
