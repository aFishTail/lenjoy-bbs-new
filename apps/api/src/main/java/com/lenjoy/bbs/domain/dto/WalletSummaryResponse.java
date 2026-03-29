package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class WalletSummaryResponse {

    private Integer availableCoins;

    private Integer frozenCoins;

    private Integer totalCoins;

    private LocalDateTime updatedAt;
}