package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class AdminCoinUserSummaryResponse {

    private Long id;

    private String username;

    private String email;

    private String phone;

    private String status;

    private Integer availableCoins;

    private Integer frozenCoins;

    private Integer totalCoins;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}