package com.lenjoy.bbs.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("bbs_tag_alias")
public class TagAliasEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("tag_id")
    private Long tagId;

    @TableField("alias_name")
    private String aliasName;

    @TableField("normalized_alias")
    private String normalizedAlias;

    @TableField("created_at")
    private LocalDateTime createdAt;

    @TableField("updated_at")
    private LocalDateTime updatedAt;
}
