package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OfflinePostRequest {

    @NotBlank(message = "下架原因不能为空")
    private String reason;
}
