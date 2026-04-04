package com.lenjoy.bbs.service;

import com.lenjoy.bbs.domain.dto.CreateOpenApiPostRequest;
import com.lenjoy.bbs.domain.dto.OpenApiPostCreateResponse;
import com.lenjoy.bbs.domain.entity.OpenApiClientEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.enums.PostType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OpenApiPostService {

    private final OpenApiAuthService openApiAuthService;
    private final OpenApiAdminService openApiAdminService;
    private final PostService postService;

    public OpenApiPostCreateResponse createPost(String apiKey, CreateOpenApiPostRequest request) {
        OpenApiClientEntity client = openApiAuthService.requireActiveClient(apiKey);
        if (request.getPostType() == PostType.BOUNTY) {
            throw new com.lenjoy.bbs.exception.ApiException("OPEN_POST_TYPE_UNSUPPORTED",
                    "Bounty posts are not supported", org.springframework.http.HttpStatus.BAD_REQUEST);
        }
        UserAccountEntity author = openApiAdminService.requireBoundActiveUser(client.getId(),
                request.getAuthorBindingCode());
        var detail = postService.create(PostCreateCommand.from(author.getId(), request));

        OpenApiPostCreateResponse response = new OpenApiPostCreateResponse();
        response.setPostId(detail.getId());
        response.setAuthorId(detail.getAuthorId());
        response.setAuthorUsername(detail.getAuthorUsername());
        response.setPostType(detail.getPostType());
        response.setStatus(detail.getStatus());
        response.setCreatedAt(detail.getCreatedAt());
        response.setDetailPath("/posts/" + detail.getId());
        return response;
    }
}
