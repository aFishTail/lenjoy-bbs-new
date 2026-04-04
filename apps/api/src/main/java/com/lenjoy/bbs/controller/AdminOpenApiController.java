package com.lenjoy.bbs.controller;

import com.lenjoy.bbs.domain.dto.ApiResponse;
import com.lenjoy.bbs.domain.dto.OpenApiBindingResponse;
import com.lenjoy.bbs.domain.dto.OpenApiClientResponse;
import com.lenjoy.bbs.domain.dto.UpdateStatusRequest;
import com.lenjoy.bbs.domain.dto.UpsertOpenApiBindingRequest;
import com.lenjoy.bbs.domain.dto.UpsertOpenApiClientRequest;
import com.lenjoy.bbs.security.AuthUserPrincipal;
import com.lenjoy.bbs.security.SecurityAccess;
import com.lenjoy.bbs.service.OpenApiAdminService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/admin/open-api")
public class AdminOpenApiController {

    private final OpenApiAdminService openApiAdminService;
    private final SecurityAccess securityAccess;

    @GetMapping("/clients")
    public ApiResponse<List<OpenApiClientResponse>> listClients(
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.listClients());
    }

    @GetMapping("/clients/{clientId}")
    public ApiResponse<OpenApiClientResponse> getClient(@PathVariable Long clientId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.getClient(clientId));
    }

    @PostMapping("/clients")
    public ApiResponse<OpenApiClientResponse> createClient(@Valid @RequestBody UpsertOpenApiClientRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.createClient(request));
    }

    @PutMapping("/clients/{clientId}")
    public ApiResponse<OpenApiClientResponse> updateClient(@PathVariable Long clientId,
            @Valid @RequestBody UpsertOpenApiClientRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.updateClient(clientId, request));
    }

    @PatchMapping("/clients/{clientId}/status")
    public ApiResponse<OpenApiClientResponse> updateClientStatus(@PathVariable Long clientId,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.updateClientStatus(clientId, request));
    }

    @DeleteMapping("/clients/{clientId}")
    public ApiResponse<Void> deleteClient(@PathVariable Long clientId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        openApiAdminService.deleteClient(clientId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/clients/{clientId}/bindings")
    public ApiResponse<List<OpenApiBindingResponse>> listBindings(@PathVariable Long clientId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.listBindings(clientId));
    }

    @PostMapping("/clients/{clientId}/bindings")
    public ApiResponse<OpenApiBindingResponse> createBinding(@PathVariable Long clientId,
            @RequestBody UpsertOpenApiBindingRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.createBinding(clientId, request));
    }

    @PutMapping("/clients/{clientId}/bindings/{bindingId}")
    public ApiResponse<OpenApiBindingResponse> updateBinding(@PathVariable Long clientId, @PathVariable Long bindingId,
            @RequestBody UpsertOpenApiBindingRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.updateBinding(clientId, bindingId, request));
    }

    @PatchMapping("/clients/{clientId}/bindings/{bindingId}/status")
    public ApiResponse<OpenApiBindingResponse> updateBindingStatus(@PathVariable Long clientId,
            @PathVariable Long bindingId,
            @Valid @RequestBody UpdateStatusRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        return ApiResponse.ok(openApiAdminService.updateBindingStatus(clientId, bindingId, request));
    }

    @DeleteMapping("/clients/{clientId}/bindings/{bindingId}")
    public ApiResponse<Void> deleteBinding(@PathVariable Long clientId, @PathVariable Long bindingId,
            @AuthenticationPrincipal AuthUserPrincipal principal) {
        securityAccess.requireAdmin(principal);
        openApiAdminService.deleteBinding(clientId, bindingId);
        return ApiResponse.ok(null);
    }
}
