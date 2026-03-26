package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.dto.CaptchaMetadataResponse;
import com.lenjoy.bbs.exception.ApiException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class CaptchaServiceTest {

    @Mock
    private StringRedisTemplate redisTemplate;

    @Mock
    private ValueOperations<String, String> valueOperations;

    private CaptchaService captchaService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOperations);
        captchaService = new CaptchaService(redisTemplate, 120, 4);
    }

    @Test
    void createCaptcha_shouldReturnMetadataAndStoreCode() {
        CaptchaMetadataResponse response = captchaService.createCaptcha("http://localhost:8080");

        assertNotNull(response.getCaptchaId());
        assertNotNull(response.getImageUrl());
        assertNotNull(response.getExpireAt());
        verify(valueOperations).set(any(), any(), eq(120L), eq(TimeUnit.SECONDS));
    }

    @Test
    void verifyAndConsume_success_shouldDeleteKey() {
        when(valueOperations.get("auth:captcha:cid")).thenReturn("a1b2");

        captchaService.verifyAndConsume("cid", "A1B2");

        verify(redisTemplate).delete("auth:captcha:cid");
    }

    @Test
    void verifyAndConsume_invalid_shouldThrow() {
        when(valueOperations.get("auth:captcha:cid")).thenReturn("a1b2");

        ApiException ex = assertThrows(ApiException.class, () -> captchaService.verifyAndConsume("cid", "XXXX"));

        assertEquals("CAPTCHA_INVALID", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }

    @Test
    void getCaptchaImage_expired_shouldThrow() {
        when(valueOperations.get("auth:captcha:cid")).thenReturn(null);

        ApiException ex = assertThrows(ApiException.class, () -> captchaService.getCaptchaImage("cid"));

        assertEquals("CAPTCHA_EXPIRED", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }
}