package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.entity.OpenApiClientEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.OpenApiClientMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class OpenApiAuthServiceTest {

    @Mock
    private OpenApiClientMapper openApiClientMapper;

    @InjectMocks
    private OpenApiAuthService openApiAuthService;

    @Test
    void requireActiveClient_whenMissingKey_shouldThrowUnauthorized() {
        ApiException ex = assertThrows(ApiException.class, () -> openApiAuthService.requireActiveClient(" "));

        assertEquals("OPEN_API_KEY_MISSING", ex.getCode());
        assertEquals(HttpStatus.UNAUTHORIZED, ex.getHttpStatus());
    }

    @Test
    void requireActiveClient_whenDisabled_shouldThrowForbidden() {
        OpenApiClientEntity entity = new OpenApiClientEntity();
        entity.setId(1L);
        entity.setApiKey("lj_test");
        entity.setStatus("INACTIVE");
        when(openApiClientMapper.selectOne(org.mockito.ArgumentMatchers.any())).thenReturn(entity);

        ApiException ex = assertThrows(ApiException.class,
                () -> openApiAuthService.requireActiveClient("lj_test"));

        assertEquals("OPEN_API_KEY_DISABLED", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }
}
