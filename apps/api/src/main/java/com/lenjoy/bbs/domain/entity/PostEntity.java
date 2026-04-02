package com.lenjoy.bbs.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("bbs_post")
public class PostEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("author_id")
    private Long authorId;

    @TableField("post_type")
    private String postType;

    @TableField("category_id")
    private Long categoryId;

    private String title;

    private String content;

    @TableField("hidden_content")
    private String hiddenContent;

    private Integer price;

    @TableField("bounty_amount")
    private Integer bountyAmount;

    @TableField("bounty_status")
    private String bountyStatus;

    @TableField("bounty_expire_at")
    private LocalDateTime bountyExpireAt;

    @TableField("bounty_settled_at")
    private LocalDateTime bountySettledAt;

    @TableField("accepted_comment_id")
    private Long acceptedCommentId;

    private String status;

    @TableField("offline_reason")
    private String offlineReason;

    @TableField("offlined_at")
    private LocalDateTime offlinedAt;

    @TableField("offlined_by")
    private Long offlinedBy;

    @TableField("is_deleted")
    private Boolean deleted;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
