package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpdateUserCoinsRequest {

    @NotBlank(message = "操作类型不能为空")
    private String operation;

    @Min(value = 1, message = "金币数量必须大于 0")
    private Integer amount;

    @NotBlank(message = "原因不能为空")
    private String reason;
}