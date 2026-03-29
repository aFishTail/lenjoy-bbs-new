package com.lenjoy.bbs.domain.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import java.time.LocalDateTime;
import lombok.Data;

@Data
@TableName("wallet_ledger")
public class WalletLedgerEntity {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("wallet_id")
    private Long walletId;

    @TableField("user_id")
    private Long userId;

    private String direction;

    @TableField("change_amount")
    private Integer changeAmount;

    @TableField("balance_after")
    private Integer balanceAfter;

    @TableField("frozen_after")
    private Integer frozenAfter;

    @TableField("biz_type")
    private String bizType;

    @TableField("biz_key")
    private String bizKey;

    private String remark;

    @TableField("operated_by")
    private Long operatedBy;

    @TableField("created_at")
    private LocalDateTime createdAt;
}