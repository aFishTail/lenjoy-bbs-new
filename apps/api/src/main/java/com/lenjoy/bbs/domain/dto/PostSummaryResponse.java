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
    private Long likeCount;
    private Long collectCount;
    private Long commentCount;
    private Boolean liked;
    private Boolean collected;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
