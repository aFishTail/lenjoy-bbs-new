package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.dto.UpsertOpenApiBindingRequest;
import com.lenjoy.bbs.domain.entity.OpenApiAccountBindingEntity;
import com.lenjoy.bbs.domain.entity.OpenApiClientEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.OpenApiAccountBindingMapper;
import com.lenjoy.bbs.mapper.OpenApiClientMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class OpenApiAdminServiceTest {

    @Mock
    private OpenApiClientMapper openApiClientMapper;

    @Mock
    private OpenApiAccountBindingMapper openApiAccountBindingMapper;

    @Mock
    private UserAccountMapper userAccountMapper;

    @InjectMocks
    private OpenApiAdminService openApiAdminService;

    @Test
    void createBinding_whenUserMissing_shouldThrowNotFound() {
        OpenApiClientEntity client = new OpenApiClientEntity();
        client.setId(1L);
        when(openApiClientMapper.selectById(1L)).thenReturn(client);
        when(openApiAccountBindingMapper.selectOne(any())).thenReturn(null);
        when(userAccountMapper.selectByUsername("ghost")).thenReturn(null);

        UpsertOpenApiBindingRequest request = new UpsertOpenApiBindingRequest();
        request.setBindingCode("partner_user_1");
        request.setUsername("ghost");

        ApiException ex = assertThrows(ApiException.class,
                () -> openApiAdminService.createBinding(1L, request));

        assertEquals("USER_NOT_FOUND", ex.getCode());
        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
    }

    @Test
    void requireBoundActiveUser_whenBindingInactive_shouldThrowNotFound() {
        OpenApiAccountBindingEntity binding = new OpenApiAccountBindingEntity();
        binding.setId(2L);
        binding.setClientId(1L);
        binding.setUserId(3L);
        binding.setBindingCode("partner_user_1");
        binding.setStatus("INACTIVE");
        when(openApiAccountBindingMapper.selectOne(any())).thenReturn(binding);

        ApiException ex = assertThrows(ApiException.class,
                () -> openApiAdminService.requireBoundActiveUser(1L, "partner_user_1"));

        assertEquals("OPEN_AUTHOR_BINDING_NOT_FOUND", ex.getCode());
        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
    }

    @Test
    void requireBoundActiveUser_whenBindingActive_shouldReturnUser() {
        OpenApiAccountBindingEntity binding = new OpenApiAccountBindingEntity();
        binding.setId(2L);
        binding.setClientId(1L);
        binding.setUserId(3L);
        binding.setBindingCode("partner_user_1");
        binding.setStatus("ACTIVE");
        UserAccountEntity user = new UserAccountEntity();
        user.setId(3L);
        user.setUsername("alice");
        when(openApiAccountBindingMapper.selectOne(any())).thenReturn(binding);
        when(userAccountMapper.selectById(3L)).thenReturn(user);

        UserAccountEntity result = openApiAdminService.requireBoundActiveUser(1L, "partner_user_1");

        assertEquals(3L, result.getId());
        assertEquals("alice", result.getUsername());
    }
}
