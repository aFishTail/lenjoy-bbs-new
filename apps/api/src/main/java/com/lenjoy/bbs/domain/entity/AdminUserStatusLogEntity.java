package com.lenjoy.bbs.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("admin_user_status_log")
public class AdminUserStatusLogEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("target_user_id")
    private Long targetUserId;

    @TableField("old_status")
    private String oldStatus;

    @TableField("new_status")
    private String newStatus;

    private String reason;

    @TableField("operated_by")
    private Long operatedBy;

    @TableField("operated_at")
    private LocalDateTime operatedAt;
}
