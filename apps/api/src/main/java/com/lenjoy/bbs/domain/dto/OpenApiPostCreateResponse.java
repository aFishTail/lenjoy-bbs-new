package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class OpenApiPostCreateResponse {

    private Long postId;
    private Long authorId;
    private String authorUsername;
    private String postType;
    private String status;
    private LocalDateTime createdAt;
    private String detailPath;
}
