package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class PostDetailResponse {

    private Long id;
    private String postType;
    private String title;
    private String status;

    private Long authorId;
    private String authorUsername;

    private String content;
    private String hiddenContent;
    private Integer price;
    private Integer bountyAmount;

    private String offlineReason;
    private LocalDateTime offlinedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
