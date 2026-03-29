package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateReportRequest {

    @NotBlank(message = "举报原因不能为空")
    @Size(max = 64, message = "举报原因最多 64 字")
    private String reason;

    @Size(max = 1000, message = "举报说明最多 1000 字")
    private String detail;
}
