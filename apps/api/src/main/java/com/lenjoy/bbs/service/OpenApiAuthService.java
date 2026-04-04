package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.entity.OpenApiClientEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.OpenApiClientMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class OpenApiAuthService {

    private final OpenApiClientMapper openApiClientMapper;

    public OpenApiClientEntity requireActiveClient(String apiKey) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            throw new ApiException("OPEN_API_KEY_MISSING", "API key is required", HttpStatus.UNAUTHORIZED);
        }
        OpenApiClientEntity client = openApiClientMapper.selectOne(new LambdaQueryWrapper<OpenApiClientEntity>()
                .eq(OpenApiClientEntity::getApiKey, apiKey.trim()));
        if (client == null) {
            throw new ApiException("OPEN_API_KEY_INVALID", "API key is invalid", HttpStatus.UNAUTHORIZED);
        }
        if (!"ACTIVE".equalsIgnoreCase(client.getStatus())) {
            throw new ApiException("OPEN_API_KEY_DISABLED", "API key is disabled", HttpStatus.FORBIDDEN);
        }
        return client;
    }
}
