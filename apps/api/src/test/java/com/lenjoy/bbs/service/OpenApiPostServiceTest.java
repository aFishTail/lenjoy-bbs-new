package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.dto.CreateOpenApiPostRequest;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.entity.OpenApiClientEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.enums.PostType;
import com.lenjoy.bbs.exception.ApiException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentMatchers;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class OpenApiPostServiceTest {

    @Mock
    private OpenApiAuthService openApiAuthService;

    @Mock
    private OpenApiAdminService openApiAdminService;

    @Mock
    private PostService postService;

    @InjectMocks
    private OpenApiPostService openApiPostService;

    @Test
    void createPost_whenBountyRequested_shouldReject() {
        OpenApiClientEntity client = new OpenApiClientEntity();
        client.setId(1L);
        client.setStatus("ACTIVE");
        when(openApiAuthService.requireActiveClient("lj_test")).thenReturn(client);
        CreateOpenApiPostRequest request = new CreateOpenApiPostRequest();
        request.setAuthorBindingCode("partner_user_1");
        request.setPostType(PostType.BOUNTY);

        ApiException ex = assertThrows(ApiException.class,
                () -> openApiPostService.createPost("lj_test", request));

        assertEquals("OPEN_POST_TYPE_UNSUPPORTED", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }

    @Test
    void createPost_shouldUseBoundUserAsAuthor() {
        OpenApiClientEntity client = new OpenApiClientEntity();
        client.setId(1L);
        client.setStatus("ACTIVE");
        UserAccountEntity author = new UserAccountEntity();
        author.setId(7L);
        author.setUsername("alice");
        PostDetailResponse detail = new PostDetailResponse();
        detail.setId(88L);
        detail.setAuthorId(7L);
        detail.setAuthorUsername("alice");
        detail.setPostType("NORMAL");
        detail.setStatus("PUBLISHED");
        when(openApiAuthService.requireActiveClient("lj_test")).thenReturn(client);
        when(openApiAdminService.requireBoundActiveUser(1L, "partner_user_1")).thenReturn(author);
        when(postService.create(ArgumentMatchers.any(PostCreateCommand.class))).thenReturn(detail);

        CreateOpenApiPostRequest request = new CreateOpenApiPostRequest();
        request.setAuthorBindingCode("partner_user_1");
        request.setPostType(PostType.NORMAL);
        request.setTitle("hello");
        request.setCategoryId(1L);
        request.setContent("body");

        var response = openApiPostService.createPost("lj_test", request);

        assertEquals(88L, response.getPostId());
        assertEquals(7L, response.getAuthorId());
        assertEquals("/posts/88", response.getDetailPath());
        verify(openApiAdminService).requireBoundActiveUser(1L, "partner_user_1");
    }
}
