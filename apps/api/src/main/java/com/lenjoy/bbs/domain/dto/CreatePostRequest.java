package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreatePostRequest {

    @NotNull(message = "帖子类型不能为空")
    private String postType;

    @NotBlank(message = "标题不能为空")
    private String title;

    private String content;

    private String hiddenContent;

    private Integer price;

    private Integer bountyAmount;
}
