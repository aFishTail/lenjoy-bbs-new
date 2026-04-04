package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.OpenApiBindingResponse;
import com.lenjoy.bbs.domain.dto.OpenApiClientResponse;
import com.lenjoy.bbs.domain.dto.UpdateStatusRequest;
import com.lenjoy.bbs.domain.dto.UpsertOpenApiBindingRequest;
import com.lenjoy.bbs.domain.dto.UpsertOpenApiClientRequest;
import com.lenjoy.bbs.domain.entity.OpenApiAccountBindingEntity;
import com.lenjoy.bbs.domain.entity.OpenApiClientEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.OpenApiAccountBindingMapper;
import com.lenjoy.bbs.mapper.OpenApiClientMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class OpenApiAdminService {

    private static final String STATUS_ACTIVE = "ACTIVE";
    private static final String STATUS_INACTIVE = "INACTIVE";

    private final OpenApiClientMapper openApiClientMapper;
    private final OpenApiAccountBindingMapper openApiAccountBindingMapper;
    private final UserAccountMapper userAccountMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    public List<OpenApiClientResponse> listClients() {
        List<OpenApiClientEntity> clients = openApiClientMapper.selectList(
                new LambdaQueryWrapper<OpenApiClientEntity>().orderByDesc(OpenApiClientEntity::getCreatedAt));
        return clients.stream().map(this::toClientResponse).toList();
    }

    public OpenApiClientResponse getClient(Long clientId) {
        return toClientResponse(requireClient(clientId));
    }

    @Transactional
    public OpenApiClientResponse createClient(UpsertOpenApiClientRequest request) {
        OpenApiClientEntity entity = new OpenApiClientEntity();
        entity.setName(normalizeRequired(request.getName(), "CLIENT_NAME_REQUIRED", "Client name is required"));
        entity.setApiKey(generateUniqueApiKey());
        entity.setStatus(normalizeStatus(request.getStatus()));
        entity.setRemark(normalizeOptional(request.getRemark()));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        openApiClientMapper.insert(entity);
        return toClientResponse(entity);
    }

    @Transactional
    public OpenApiClientResponse updateClient(Long clientId, UpsertOpenApiClientRequest request) {
        OpenApiClientEntity entity = requireClient(clientId);
        entity.setName(normalizeRequired(request.getName(), "CLIENT_NAME_REQUIRED", "Client name is required"));
        entity.setStatus(normalizeStatus(request.getStatus()));
        entity.setRemark(normalizeOptional(request.getRemark()));
        entity.setUpdatedAt(LocalDateTime.now());
        openApiClientMapper.updateById(entity);
        return toClientResponse(entity);
    }

    @Transactional
    public OpenApiClientResponse updateClientStatus(Long clientId, UpdateStatusRequest request) {
        OpenApiClientEntity entity = requireClient(clientId);
        entity.setStatus(normalizeStatus(request.getStatus()));
        entity.setUpdatedAt(LocalDateTime.now());
        openApiClientMapper.updateById(entity);
        return toClientResponse(entity);
    }

    @Transactional
    public void deleteClient(Long clientId) {
        OpenApiClientEntity client = requireClient(clientId);
        long bindingCount = openApiAccountBindingMapper.selectCount(
                new LambdaQueryWrapper<OpenApiAccountBindingEntity>().eq(OpenApiAccountBindingEntity::getClientId,
                        client.getId()));
        if (bindingCount > 0) {
            throw new ApiException("OPEN_API_CLIENT_HAS_BINDINGS", "Delete bindings before deleting the client",
                    HttpStatus.BAD_REQUEST);
        }
        openApiClientMapper.deleteById(clientId);
    }

    public List<OpenApiBindingResponse> listBindings(Long clientId) {
        requireClient(clientId);
        List<OpenApiAccountBindingEntity> bindings = openApiAccountBindingMapper.selectList(
                new LambdaQueryWrapper<OpenApiAccountBindingEntity>()
                        .eq(OpenApiAccountBindingEntity::getClientId, clientId)
                        .orderByDesc(OpenApiAccountBindingEntity::getCreatedAt));
        return bindings.stream().map(this::toBindingResponse).toList();
    }

    @Transactional
    public OpenApiBindingResponse createBinding(Long clientId, UpsertOpenApiBindingRequest request) {
        requireClient(clientId);
        String bindingCode = normalizeRequired(request.getBindingCode(), "BINDING_CODE_REQUIRED",
                "Binding code is required");
        ensureBindingCodeAvailable(bindingCode, null);
        UserAccountEntity user = resolveUser(request);

        OpenApiAccountBindingEntity entity = new OpenApiAccountBindingEntity();
        entity.setClientId(clientId);
        entity.setUserId(user.getId());
        entity.setBindingCode(bindingCode);
        entity.setStatus(normalizeStatus(request.getStatus()));
        entity.setRemark(normalizeOptional(request.getRemark()));
        entity.setCreatedAt(LocalDateTime.now());
        entity.setUpdatedAt(LocalDateTime.now());
        openApiAccountBindingMapper.insert(entity);
        return toBindingResponse(entity);
    }

    @Transactional
    public OpenApiBindingResponse updateBinding(Long clientId, Long bindingId, UpsertOpenApiBindingRequest request) {
        requireClient(clientId);
        OpenApiAccountBindingEntity entity = requireBinding(clientId, bindingId);
        String bindingCode = normalizeRequired(request.getBindingCode(), "BINDING_CODE_REQUIRED",
                "Binding code is required");
        ensureBindingCodeAvailable(bindingCode, bindingId);
        UserAccountEntity user = resolveUser(request);

        entity.setBindingCode(bindingCode);
        entity.setUserId(user.getId());
        entity.setStatus(normalizeStatus(request.getStatus()));
        entity.setRemark(normalizeOptional(request.getRemark()));
        entity.setUpdatedAt(LocalDateTime.now());
        openApiAccountBindingMapper.updateById(entity);
        return toBindingResponse(entity);
    }

    @Transactional
    public OpenApiBindingResponse updateBindingStatus(Long clientId, Long bindingId, UpdateStatusRequest request) {
        requireClient(clientId);
        OpenApiAccountBindingEntity entity = requireBinding(clientId, bindingId);
        entity.setStatus(normalizeStatus(request.getStatus()));
        entity.setUpdatedAt(LocalDateTime.now());
        openApiAccountBindingMapper.updateById(entity);
        return toBindingResponse(entity);
    }

    @Transactional
    public void deleteBinding(Long clientId, Long bindingId) {
        requireClient(clientId);
        requireBinding(clientId, bindingId);
        openApiAccountBindingMapper.deleteById(bindingId);
    }

    public UserAccountEntity requireBoundActiveUser(Long clientId, String bindingCode) {
        String normalizedCode = normalizeRequired(bindingCode, "OPEN_AUTHOR_BINDING_NOT_FOUND",
                "Author binding not found");
        OpenApiAccountBindingEntity binding = openApiAccountBindingMapper.selectOne(
                new LambdaQueryWrapper<OpenApiAccountBindingEntity>()
                        .eq(OpenApiAccountBindingEntity::getClientId, clientId)
                        .eq(OpenApiAccountBindingEntity::getBindingCode, normalizedCode));
        if (binding == null || !STATUS_ACTIVE.equalsIgnoreCase(binding.getStatus())) {
            throw new ApiException("OPEN_AUTHOR_BINDING_NOT_FOUND", "Author binding not found", HttpStatus.NOT_FOUND);
        }
        UserAccountEntity user = userAccountMapper.selectById(binding.getUserId());
        if (user == null) {
            throw new ApiException("OPEN_AUTHOR_BINDING_NOT_FOUND", "Author binding not found", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private OpenApiClientEntity requireClient(Long clientId) {
        OpenApiClientEntity client = openApiClientMapper.selectById(clientId);
        if (client == null) {
            throw new ApiException("OPEN_API_CLIENT_NOT_FOUND", "Open API client not found", HttpStatus.NOT_FOUND);
        }
        return client;
    }

    private OpenApiAccountBindingEntity requireBinding(Long clientId, Long bindingId) {
        OpenApiAccountBindingEntity binding = openApiAccountBindingMapper.selectById(bindingId);
        if (binding == null || !binding.getClientId().equals(clientId)) {
            throw new ApiException("OPEN_API_BINDING_NOT_FOUND", "Open API binding not found", HttpStatus.NOT_FOUND);
        }
        return binding;
    }

    private void ensureBindingCodeAvailable(String bindingCode, Long currentBindingId) {
        OpenApiAccountBindingEntity existing = openApiAccountBindingMapper.selectOne(
                new LambdaQueryWrapper<OpenApiAccountBindingEntity>()
                        .eq(OpenApiAccountBindingEntity::getBindingCode, bindingCode));
        if (existing != null && (currentBindingId == null || !existing.getId().equals(currentBindingId))) {
            throw new ApiException("BINDING_CODE_EXISTS", "Binding code already exists", HttpStatus.CONFLICT);
        }
    }

    private UserAccountEntity resolveUser(UpsertOpenApiBindingRequest request) {
        if (request.getUserId() == null && (request.getUsername() == null || request.getUsername().trim().isEmpty())) {
            throw new ApiException("OPEN_API_BINDING_USER_REQUIRED", "User ID or username is required",
                    HttpStatus.BAD_REQUEST);
        }
        UserAccountEntity user = request.getUserId() != null
                ? userAccountMapper.selectById(request.getUserId())
                : userAccountMapper.selectByUsername(request.getUsername().trim());
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "User not found", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private OpenApiClientResponse toClientResponse(OpenApiClientEntity entity) {
        OpenApiClientResponse response = new OpenApiClientResponse();
        response.setId(entity.getId());
        response.setName(entity.getName());
        response.setApiKeyMasked(maskApiKey(entity.getApiKey()));
        response.setApiKeyPlaintext(entity.getApiKey());
        response.setStatus(entity.getStatus());
        response.setRemark(entity.getRemark());
        long bindingCount = openApiAccountBindingMapper.selectCount(
                new LambdaQueryWrapper<OpenApiAccountBindingEntity>()
                        .eq(OpenApiAccountBindingEntity::getClientId, entity.getId()));
        response.setBindingCount(Math.toIntExact(bindingCount));
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }

    private OpenApiBindingResponse toBindingResponse(OpenApiAccountBindingEntity entity) {
        UserAccountEntity user = userAccountMapper.selectById(entity.getUserId());
        OpenApiBindingResponse response = new OpenApiBindingResponse();
        response.setId(entity.getId());
        response.setClientId(entity.getClientId());
        response.setBindingCode(entity.getBindingCode());
        response.setStatus(entity.getStatus());
        response.setRemark(entity.getRemark());
        response.setUserId(entity.getUserId());
        if (user != null) {
            response.setUsername(user.getUsername());
            response.setEmail(user.getEmail());
            response.setPhone(user.getPhone());
        }
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.trim().isEmpty()) {
            return STATUS_ACTIVE;
        }
        String normalized = status.trim().toUpperCase();
        if (!STATUS_ACTIVE.equals(normalized) && !STATUS_INACTIVE.equals(normalized)) {
            throw new ApiException("STATUS_INVALID", "Status is invalid", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeRequired(String value, String code, String message) {
        String normalized = normalizeOptional(value);
        if (normalized == null) {
            throw new ApiException(code, message, HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String generateUniqueApiKey() {
        for (int i = 0; i < 10; i++) {
            byte[] bytes = new byte[12];
            secureRandom.nextBytes(bytes);
            String candidate = "lj_" + HexFormat.of().formatHex(bytes);
            long count = openApiClientMapper.selectCount(
                    new LambdaQueryWrapper<OpenApiClientEntity>().eq(OpenApiClientEntity::getApiKey, candidate));
            if (count == 0) {
                return candidate;
            }
        }
        throw new ApiException("OPEN_API_KEY_GENERATE_FAILED", "Failed to generate API key",
                HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private String maskApiKey(String apiKey) {
        if (apiKey == null || apiKey.length() <= 8) {
            return "****";
        }
        return apiKey.substring(0, 5) + "****" + apiKey.substring(apiKey.length() - 4);
    }
}
