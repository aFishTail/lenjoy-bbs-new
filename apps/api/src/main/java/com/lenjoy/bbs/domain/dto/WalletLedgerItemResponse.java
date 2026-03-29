package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class WalletLedgerItemResponse {

    private Long id;

    private String direction;

    private Integer changeAmount;

    private Integer balanceAfter;

    private Integer frozenAfter;

    private String bizType;

    private String remark;

    private Long operatedBy;

    private LocalDateTime createdAt;
}