package com.lenjoy.bbs.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("resource_appeal")
public class ResourceAppealEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("purchase_id")
    private Long purchaseId;

    @TableField("post_id")
    private Long postId;

    @TableField("buyer_id")
    private Long buyerId;

    @TableField("seller_id")
    private Long sellerId;

    private String reason;

    private String detail;

    private String status;

    @TableField("requested_refund_amount")
    private Integer requestedRefundAmount;

    @TableField("resolved_refund_amount")
    private Integer resolvedRefundAmount;

    @TableField("resolution_note")
    private String resolutionNote;

    @TableField("resolved_by")
    private Long resolvedBy;

    @TableField("resolved_at")
    private LocalDateTime resolvedAt;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}