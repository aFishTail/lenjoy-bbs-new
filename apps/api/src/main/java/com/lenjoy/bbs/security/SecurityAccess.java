package com.lenjoy.bbs.security;

import com.lenjoy.bbs.exception.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
public class SecurityAccess {

    public AuthUserPrincipal requireAuthenticated(AuthUserPrincipal principal) {
        if (principal == null) {
            throw new ApiException("UNAUTHORIZED", "请先登录", HttpStatus.UNAUTHORIZED);
        }
        return principal;
    }

    public AuthUserPrincipal requireAdmin(AuthUserPrincipal principal) {
        AuthUserPrincipal currentUser = requireAuthenticated(principal);
        if (!isAdmin(currentUser)) {
            throw new ApiException("FORBIDDEN", "仅管理员可执行该操作", HttpStatus.FORBIDDEN);
        }
        return currentUser;
    }

    public boolean isAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getAuthorities() == null) {
            return false;
        }
        return principal.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }
}
