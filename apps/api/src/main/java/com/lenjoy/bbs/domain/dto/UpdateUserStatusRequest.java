package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateUserStatusRequest {

    @NotBlank(message = "状态不能为空")
    private String status;

    @NotBlank(message = "原因不能为空")
    private String reason;
}
