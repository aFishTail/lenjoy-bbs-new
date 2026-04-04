package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertOpenApiClientRequest {

    @NotBlank(message = "Client name is required")
    private String name;

    private String remark;

    private String status;
}
