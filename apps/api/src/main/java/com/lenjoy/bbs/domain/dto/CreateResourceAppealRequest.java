package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateResourceAppealRequest {

    @NotBlank(message = "申诉原因不能为空")
    @Size(max = 255, message = "申诉原因最多 255 字")
    private String reason;

    @Size(max = 1000, message = "补充说明最多 1000 字")
    private String detail;
}