package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class DeleteCommentRequest {

    @NotBlank(message = "删除原因不能为空")
    @Size(max = 255, message = "删除原因最多 255 字")
    private String reason;
}