package com.lenjoy.bbs.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;

import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.TaxonomyService;
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
class AdminTaxonomyControllerTest {

    @Mock
    private TaxonomyService taxonomyService;

    @Spy
    private SecurityAccess securityAccess;

    @InjectMocks
    private AdminTaxonomyController controller;

    @Test
    void deleteCategory_whenNonAdmin_shouldThrowForbidden() {
        AuthUserPrincipal principal = userPrincipal(1L, "user");

        ApiException ex = assertThrows(ApiException.class, () -> controller.deleteCategory(5L, principal));

        assertEquals("FORBIDDEN", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void deleteCategory_whenAdmin_shouldDelegate() {
        AuthUserPrincipal principal = adminPrincipal(9L, "admin");

        var response = controller.deleteCategory(5L, principal);

        assertEquals(null, response.getData());
        verify(taxonomyService).deleteCategory(5L);
    }

    @Test
    void deleteTag_whenAdmin_shouldDelegate() {
        AuthUserPrincipal principal = adminPrincipal(9L, "admin");

        var response = controller.deleteTag(7L, principal);

        assertEquals(null, response.getData());
        verify(taxonomyService).deleteTag(7L);
    }

    private AuthUserPrincipal userPrincipal(Long userId, String username) {
        return new AuthUserPrincipal(userId, username, List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    private AuthUserPrincipal adminPrincipal(Long userId, String username) {
        return new AuthUserPrincipal(userId, username, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }
}
