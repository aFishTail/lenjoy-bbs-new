package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class SiteMessageResponse {

    private Long id;

    private String messageType;

    private String title;

    private String content;

    private String bizType;

    private Long bizId;

    private Long relatedPostId;

    private Long relatedPurchaseId;

    private Long relatedAppealId;

    private boolean read;

    private LocalDateTime readAt;

    private LocalDateTime createdAt;

    private String actionUrl;
}