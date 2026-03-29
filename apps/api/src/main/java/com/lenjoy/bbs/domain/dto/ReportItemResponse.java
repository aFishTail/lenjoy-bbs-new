package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class ReportItemResponse {

    private String targetType;

    private Long reportId;

    private Long targetId;

    private Long reporterId;

    private String reporterUsername;

    private String reason;

    private String detail;

    private String status;

    private String resolutionNote;

    private Long handledBy;

    private String handledByUsername;

    private LocalDateTime createdAt;

    private LocalDateTime handledAt;

    private String targetTitle;
}
