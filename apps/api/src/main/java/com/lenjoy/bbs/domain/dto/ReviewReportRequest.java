package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ReviewReportRequest {

    @NotBlank(message = "处理状态不能为空")
    private String status;

    private String action;

    @Size(max = 255, message = "处理说明最多 255 字")
    private String resolutionNote;

    private Long targetUserId;
}
