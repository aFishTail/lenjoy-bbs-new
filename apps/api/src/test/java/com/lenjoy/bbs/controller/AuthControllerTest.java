package com.lenjoy.bbs.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.lenjoy.bbs.domain.dto.AuthResponse;
import com.lenjoy.bbs.domain.dto.CaptchaMetadataResponse;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.exception.GlobalExceptionHandler;
import com.lenjoy.bbs.security.JwtTokenProvider;
import com.lenjoy.bbs.service.AuthService;
import com.lenjoy.bbs.service.CaptchaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AuthService authService;

    @MockitoBean
    private CaptchaService captchaService;

    @MockitoBean
    private JwtTokenProvider jwtTokenProvider;

    @Test
    void captchaMetadata_shouldReturnSuccess() throws Exception {
        when(captchaService.createCaptcha(any()))
                .thenReturn(new CaptchaMetadataResponse("cid", "http://localhost/img", 123L));

        mockMvc.perform(get("/api/v1/auth/captcha"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.captchaId").value("cid"))
                .andExpect(jsonPath("$.data.imageUrl").value("http://localhost/img"));
    }

    @Test
    void captchaImage_shouldReturnPngWithNoStore() throws Exception {
        when(captchaService.getCaptchaImage("cid")).thenReturn(new byte[] { 1, 2, 3 });

        mockMvc.perform(get("/api/v1/auth/captcha/cid/image"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.IMAGE_PNG))
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
    }

    @Test
    void register_shouldReturnToken() throws Exception {
        AuthResponse authResponse = new AuthResponse();
        authResponse.setToken("jwt");
        authResponse.setTokenType("Bearer");
        authResponse.setExpiresIn(7200L);
        when(authService.register(any())).thenReturn(authResponse);

        String body = """
                {
                  "username":"alice",
                  "password":"Pass123",
                  "email":"alice@example.com",
                  "captchaId":"cid",
                  "captchaCode":"A1B2"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.token").value("jwt"));
    }

    @Test
    void login_whenServiceThrows_shouldReturnBusinessError() throws Exception {
        when(authService.login(any())).thenThrow(new ApiException("LOGIN_FAILED", "账号或密码错误", HttpStatus.UNAUTHORIZED));

        String body = """
                {
                  "account":"alice@example.com",
                  "password":"wrong",
                  "captchaId":"cid",
                  "captchaCode":"A1B2"
                }
                """;

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("LOGIN_FAILED"))
                .andExpect(jsonPath("$.message").value("账号或密码错误"));
    }
}