package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReviewResourceAppealRequest {

    @NotBlank(message = "处理动作不能为空")
    private String action;

    @Min(value = 0, message = "退款金额不能为负数")
    private Integer refundAmount;

    @Size(max = 255, message = "处理说明最多 255 字")
    private String resolutionNote;
}