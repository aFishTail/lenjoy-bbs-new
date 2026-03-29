package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class CreateCommentRequest {

    private Long parentId;

    @Size(max = 10000, message = "评论内容过长")
    private String content;
}