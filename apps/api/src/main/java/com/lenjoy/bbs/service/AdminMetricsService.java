package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.AdminDashboardMetricsResponse;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.ResourcePurchaseEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.ResourcePurchaseMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.WalletLedgerMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminMetricsService {

    private final UserAccountMapper userAccountMapper;
    private final PostMapper postMapper;
    private final ResourcePurchaseMapper resourcePurchaseMapper;
    private final WalletLedgerMapper walletLedgerMapper;

    public AdminDashboardMetricsResponse dashboardMetrics() {
        AdminDashboardMetricsResponse response = new AdminDashboardMetricsResponse();
        long userCount = userAccountMapper.selectCount(new LambdaQueryWrapper<UserAccountEntity>());
        long postCount = postMapper.selectCount(new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getDeleted, false));
        long bountyCount = postMapper.selectCount(new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getPostType, "BOUNTY")
                .eq(PostEntity::getDeleted, false));
        long bountyResolved = postMapper.selectCount(new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getPostType, "BOUNTY")
                .eq(PostEntity::getBountyStatus, "RESOLVED")
                .eq(PostEntity::getDeleted, false));
        long purchaseCount = resourcePurchaseMapper.selectCount(new LambdaQueryWrapper<ResourcePurchaseEntity>());

        long issued = walletLedgerMapper.sumChangeAmountByDirection("INCOME");
        long consumed = walletLedgerMapper.sumChangeAmountByDirection("EXPENSE");

        response.setNewUserCount(userCount);
        response.setPostCount(postCount);
        response.setResourcePurchaseCount(purchaseCount);
        response.setBountyPostCount(bountyCount);
        response.setBountyAcceptanceRate(bountyCount == 0 ? 0 : (double) bountyResolved / (double) bountyCount);
        response.setTotalCoinIssued(issued);
        response.setTotalCoinConsumed(consumed);
        return response;
    }
}
