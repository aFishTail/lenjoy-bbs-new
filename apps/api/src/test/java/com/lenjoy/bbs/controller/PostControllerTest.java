package com.lenjoy.bbs.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.OfflinePostRequest;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.PostSummaryResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.service.PostService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class PostControllerTest {

    @Mock
    private PostService postService;

    @InjectMocks
    private PostController postController;

    @Test
    void list_shouldAllowAnonymous() {
        List<PostSummaryResponse> expected = List.of(new PostSummaryResponse());
        when(postService.listPublic("NORMAL")).thenReturn(expected);

        var response = postController.list("NORMAL");

        assertEquals(expected, response.getData());
        verify(postService).listPublic("NORMAL");
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
        CreatePostRequest request = new CreatePostRequest();

        ApiException ex = assertThrows(ApiException.class, () -> postController.create(request, null));

        assertEquals("UNAUTHORIZED", ex.getCode());
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getHttpStatus());
    }

    @Test
    void create_whenAuthenticated_shouldDelegateWithUserId() {
        Authentication auth = userAuth(5L, "u1");
        PostDetailResponse detail = new PostDetailResponse();
        detail.setId(77L);
        CreatePostRequest request = new CreatePostRequest();
        when(postService.create(5L, request)).thenReturn(detail);
        var response = postController.create(request, auth);

        assertEquals(77L, response.getData().getId());
        verify(postService).create(5L, request);
    }

    @Test
    void listAdmin_whenNonAdmin_shouldThrowForbidden() {
        Authentication auth = userAuth(1L, "user");

        ApiException ex = assertThrows(ApiException.class, () -> postController.listAdmin(null, null, null, auth));

        assertEquals("FORBIDDEN", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void offline_whenNonAdmin_shouldThrowForbidden() {
        Authentication auth = userAuth(1L, "user");
        OfflinePostRequest request = new OfflinePostRequest();
        request.setReason("违规");

        ApiException ex = assertThrows(ApiException.class, () -> postController.offline(9L, request, auth));

        assertEquals("FORBIDDEN", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void offline_whenAdmin_shouldDelegate() {
        Authentication auth = adminAuth(9L, "admin");
        OfflinePostRequest request = new OfflinePostRequest();
        request.setReason("违规");

        var response = postController.offline(3L, request, auth);

        assertEquals(null, response.getData());
        verify(postService).offline(3L, 9L, request);
    }

    private Authentication userAuth(Long userId, String username) {
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_USER"));
        AuthUserPrincipal principal = new AuthUserPrincipal(userId, username, authorities);
        return new UsernamePasswordAuthenticationToken(
                principal,
                null,
                authorities);
    }

    private Authentication adminAuth(Long userId, String username) {
        var authorities = List.of(new SimpleGrantedAuthority("ROLE_ADMIN"));
        AuthUserPrincipal principal = new AuthUserPrincipal(userId, username, authorities);
        return new UsernamePasswordAuthenticationToken(
                principal,
                null,
                authorities);
    }
}
