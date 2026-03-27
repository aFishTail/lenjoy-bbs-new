package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class PostSummaryResponse {

    private Long id;
    private String postType;
    private String title;
    private String status;
    private Long authorId;
    private String authorUsername;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
