package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class ResourceAppealResponse {

    private Long id;

    private Long purchaseId;

    private Long postId;

    private String postTitle;

    private String reason;

    private String detail;

    private String status;

    private Integer requestedRefundAmount;

    private Integer resolvedRefundAmount;

    private String resolutionNote;

    private Long buyerId;

    private String buyerUsername;

    private Long sellerId;

    private String sellerUsername;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}