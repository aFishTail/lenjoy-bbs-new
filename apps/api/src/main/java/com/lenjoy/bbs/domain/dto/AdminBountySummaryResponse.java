package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class AdminBountySummaryResponse {

    private Long id;

    private String title;

    private Long authorId;

    private String authorUsername;

    private String status;

    private String bountyStatus;

    private Integer bountyAmount;

    private Integer answerCount;

    private Long acceptedCommentId;

    private LocalDateTime bountyExpireAt;

    private LocalDateTime bountySettledAt;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}