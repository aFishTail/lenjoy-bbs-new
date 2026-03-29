package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class ResourceTradeAuditItemResponse {

    private Long purchaseId;

    private Long postId;

    private String postTitle;

    private Long buyerId;

    private String buyerUsername;

    private Long sellerId;

    private String sellerUsername;

    private Integer price;

    private Integer refundedAmount;

    private String status;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
