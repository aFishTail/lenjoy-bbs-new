package com.lenjoy.bbs.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.dto.CreateNormalPostRequest;
import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.OfflinePostRequest;
import com.lenjoy.bbs.domain.dto.PageResponse;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.PostSummaryResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.PostService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class PostControllerTest {

    @Mock
    private PostService postService;

    @Spy
    private SecurityAccess securityAccess;

    @InjectMocks
    private PostController postController;

    @Test
    void list_shouldAllowAnonymous() {
        PageResponse<PostSummaryResponse> expected = new PageResponse<>();
        expected.setItems(List.of(new PostSummaryResponse()));
        when(postService.listPublic("NORMAL", null, null, null, 1, 20)).thenReturn(expected);

        var response = postController.list("NORMAL", null, null, null, 1, 20);

        assertEquals(expected, response.getData());
        verify(postService).listPublic("NORMAL", null, null, null, 1, 20);
    }

    @Test
    void detail_shouldAllowAnonymous() {
        PostDetailResponse detail = new PostDetailResponse();
        detail.setId(10L);
        when(postService.detail(10L, null, false)).thenReturn(detail);

        var response = postController.detail(10L, null);

        assertEquals(10L, response.getData().getId());
        verify(postService).detail(10L, null, false);
    }

    @Test
    void create_whenUnauthenticated_shouldThrowUnauthorized() {
        CreatePostRequest request = new CreateNormalPostRequest();

        ApiException ex = assertThrows(ApiException.class, () -> postController.create(request, null));

        assertEquals("UNAUTHORIZED", ex.getCode());
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getHttpStatus());
    }

    @Test
    void create_whenAuthenticated_shouldDelegateWithUserId() {
        AuthUserPrincipal principal = userPrincipal(5L, "u1");
        PostDetailResponse detail = new PostDetailResponse();
        detail.setId(77L);
        CreatePostRequest request = new CreateNormalPostRequest();
        when(postService.create(5L, request)).thenReturn(detail);

        var response = postController.create(request, principal);

        assertEquals(77L, response.getData().getId());
        verify(postService).create(5L, request);
    }

    @Test
    void listAdmin_whenNonAdmin_shouldThrowForbidden() {
        AuthUserPrincipal principal = userPrincipal(1L, "user");

        ApiException ex = assertThrows(ApiException.class,
                () -> postController.listAdmin(null, null, null, null, null, principal));

        assertEquals("FORBIDDEN", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void offline_whenNonAdmin_shouldThrowForbidden() {
        AuthUserPrincipal principal = userPrincipal(1L, "user");
        OfflinePostRequest request = new OfflinePostRequest();
        request.setReason("invalid");

        ApiException ex = assertThrows(ApiException.class, () -> postController.offline(9L, request, principal));

        assertEquals("FORBIDDEN", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void offline_whenAdmin_shouldDelegate() {
        AuthUserPrincipal principal = adminPrincipal(9L, "admin");
        OfflinePostRequest request = new OfflinePostRequest();
        request.setReason("invalid");

        var response = postController.offline(3L, request, principal);

        assertEquals(null, response.getData());
        verify(postService).offline(3L, 9L, request);
    }

    private AuthUserPrincipal userPrincipal(Long userId, String username) {
        return new AuthUserPrincipal(userId, username, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private AuthUserPrincipal adminPrincipal(Long userId, String username) {
        return new AuthUserPrincipal(userId, username, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }
}
