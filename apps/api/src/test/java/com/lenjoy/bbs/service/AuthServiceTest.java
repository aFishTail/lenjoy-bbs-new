package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.dto.AuthResponse;
import com.lenjoy.bbs.domain.dto.LoginRequest;
import com.lenjoy.bbs.domain.dto.RegisterRequest;
import com.lenjoy.bbs.domain.entity.RoleEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.entity.UserRoleEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.RoleMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.UserRoleMapper;
import com.lenjoy.bbs.security.JwtTokenProvider;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UserAccountMapper userAccountMapper;
    @Mock
    private RoleMapper roleMapper;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private JwtTokenProvider jwtTokenProvider;
    @Mock
    private CaptchaService captchaService;

    @InjectMocks
    private AuthService authService;

    @Test
    void register_success_shouldReturnTokenAndUser() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setPassword("Pass123");
        request.setEmail("alice@example.com");
        request.setCaptchaId("cid");
        request.setCaptchaCode("a1b2");

        doNothing().when(captchaService).verifyAndConsume("cid", "a1b2");
        when(userAccountMapper.selectCount(any())).thenReturn(0L);
        when(passwordEncoder.encode("Pass123")).thenReturn("hashed_pass");
        doAnswer(invocation -> {
            UserAccountEntity user = invocation.getArgument(0);
            user.setId(1L);
            return 1;
        }).when(userAccountMapper).insert(any(UserAccountEntity.class));

        RoleEntity role = new RoleEntity();
        role.setId(10L);
        role.setRoleCode("USER");
        when(roleMapper.selectOne(any())).thenReturn(role);
        when(jwtTokenProvider.createAccessToken(eq(1L), eq("alice"), anyList())).thenReturn("jwt_token");
        when(jwtTokenProvider.getAccessTokenTtlSeconds()).thenReturn(7200L);

        AuthResponse response = authService.register(request);

        assertEquals("jwt_token", response.getToken());
        assertEquals("Bearer", response.getTokenType());
        assertEquals(7200L, response.getExpiresIn());
        assertEquals(1L, response.getUser().getId());
        assertEquals("alice", response.getUser().getUsername());
        verify(userRoleMapper).insert(any(UserRoleEntity.class));
    }

    @Test
    void register_usernameExists_shouldThrowConflict() {
        RegisterRequest request = new RegisterRequest();
        request.setUsername("alice");
        request.setPassword("Pass123");
        request.setPhone("13800000000");
        request.setCaptchaId("cid");
        request.setCaptchaCode("a1b2");

        doNothing().when(captchaService).verifyAndConsume("cid", "a1b2");
        when(userAccountMapper.selectCount(any())).thenReturn(1L);

        ApiException ex = assertThrows(ApiException.class, () -> authService.register(request));
        assertEquals("USERNAME_EXISTS", ex.getCode());
        assertEquals(HttpStatus.CONFLICT, ex.getHttpStatus());
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void login_success_shouldReturnTokenAndRoles() {
        LoginRequest request = new LoginRequest();
        request.setAccount("alice@example.com");
        request.setPassword("Pass123");
        request.setCaptchaId("cid");
        request.setCaptchaCode("a1b2");

        doNothing().when(captchaService).verifyAndConsume("cid", "a1b2");

        UserAccountEntity user = new UserAccountEntity();
        user.setId(2L);
        user.setUsername("alice");
        user.setEmail("alice@example.com");
        user.setPasswordHash("hashed_pass");
        user.setStatus("ACTIVE");
        when(userAccountMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("Pass123", "hashed_pass")).thenReturn(true);

        UserRoleEntity bind = new UserRoleEntity();
        bind.setRoleId(10L);
        when(userRoleMapper.selectList(any())).thenReturn(List.of(bind));

        RoleEntity role = new RoleEntity();
        role.setId(10L);
        role.setRoleCode("USER");
        when(roleMapper.selectList(any())).thenReturn(List.of(role));

        when(jwtTokenProvider.createAccessToken(eq(2L), eq("alice"), eq(List.of("USER")))).thenReturn("jwt_login");
        when(jwtTokenProvider.getAccessTokenTtlSeconds()).thenReturn(7200L);

        AuthResponse response = authService.login(request);

        assertEquals("jwt_login", response.getToken());
        assertEquals("alice", response.getUser().getUsername());
    }

    @Test
    void login_wrongPassword_shouldThrowUnauthorized() {
        LoginRequest request = new LoginRequest();
        request.setAccount("alice@example.com");
        request.setPassword("wrong");
        request.setCaptchaId("cid");
        request.setCaptchaCode("a1b2");

        doNothing().when(captchaService).verifyAndConsume("cid", "a1b2");

        UserAccountEntity user = new UserAccountEntity();
        user.setPasswordHash("hashed_pass");
        user.setStatus("ACTIVE");
        when(userAccountMapper.selectOne(any())).thenReturn(user);
        when(passwordEncoder.matches("wrong", "hashed_pass")).thenReturn(false);

        ApiException ex = assertThrows(ApiException.class, () -> authService.login(request));
        assertEquals("LOGIN_FAILED", ex.getCode());
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getHttpStatus());
    }

    @Test
    void login_username_shouldFallbackFromPhoneToUsername() {
        LoginRequest request = new LoginRequest();
        request.setAccount("alice");
        request.setPassword("Pass123");
        request.setCaptchaId("cid");
        request.setCaptchaCode("a1b2");

        doNothing().when(captchaService).verifyAndConsume("cid", "a1b2");

        UserAccountEntity user = new UserAccountEntity();
        user.setId(3L);
        user.setUsername("alice");
        user.setPasswordHash("hashed_pass");
        user.setStatus("ACTIVE");

        when(userAccountMapper.selectOne(any())).thenReturn(null, user);
        when(passwordEncoder.matches("Pass123", "hashed_pass")).thenReturn(true);
        when(userRoleMapper.selectList(any())).thenReturn(List.of());

        when(jwtTokenProvider.createAccessToken(eq(3L), eq("alice"), eq(List.of("USER"))))
                .thenReturn("jwt_username");
        when(jwtTokenProvider.getAccessTokenTtlSeconds()).thenReturn(7200L);

        AuthResponse response = authService.login(request);

        assertEquals("jwt_username", response.getToken());
        assertEquals("alice", response.getUser().getUsername());
        verify(userAccountMapper, times(2)).selectOne(any());
    }
}