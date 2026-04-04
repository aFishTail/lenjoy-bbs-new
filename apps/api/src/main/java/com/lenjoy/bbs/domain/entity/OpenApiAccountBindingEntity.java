package com.lenjoy.bbs.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("open_api_account_binding")
public class OpenApiAccountBindingEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("client_id")
    private Long clientId;

    @TableField("user_id")
    private Long userId;

    @TableField("binding_code")
    private String bindingCode;

    private String status;

    private String remark;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
