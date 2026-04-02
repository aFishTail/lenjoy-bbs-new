package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Data;

@Data
public class PostDetailResponse {

    private Long id;
    private String postType;
    private String title;
    private String status;

    private Long authorId;
    private String authorUsername;
    private Long categoryId;
    private String categoryName;
    private List<TagResponse> tags;

    private String content;
    private String hiddenContent;
    private Integer price;
    private Integer bountyAmount;
    private String bountyStatus;
    private LocalDateTime bountyExpireAt;
    private LocalDateTime bountySettledAt;
    private Long acceptedCommentId;

    private Boolean resourceUnlocked;
    private Boolean purchased;
    private Boolean canPurchase;
    private Long purchaseId;
    private String purchaseStatus;
    private Integer refundedAmount;
    private String appealStatus;

    private Long likeCount;
    private Long collectCount;
    private Long commentCount;
    private Boolean liked;
    private Boolean collected;

    private String offlineReason;
    private LocalDateTime offlinedAt;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
