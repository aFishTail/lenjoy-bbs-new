package com.lenjoy.bbs.domain.dto;

import lombok.Data;

@Data
public class AdminDashboardMetricsResponse {

    private long newUserCount;

    private long postCount;

    private long resourcePurchaseCount;

    private long bountyPostCount;

    private double bountyAcceptanceRate;

    private long totalCoinIssued;

    private long totalCoinConsumed;
}
