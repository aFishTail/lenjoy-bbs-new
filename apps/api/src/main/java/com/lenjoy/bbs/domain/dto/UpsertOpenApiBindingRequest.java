package com.lenjoy.bbs.domain.dto;

import lombok.Data;

@Data
public class UpsertOpenApiBindingRequest {

    private Long userId;

    private String username;

    private String bindingCode;

    private String status;

    private String remark;
}
