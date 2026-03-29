package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.ResourceTradeAuditItemResponse;
import com.lenjoy.bbs.domain.dto.WalletLedgerItemResponse;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.ResourcePurchaseEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.entity.WalletLedgerEntity;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.ResourcePurchaseMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.WalletLedgerMapper;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminAuditService {

    private static final int DEFAULT_LIMIT = 100;
    private static final int MAX_LIMIT = 500;

    private final WalletLedgerMapper walletLedgerMapper;
    private final ResourcePurchaseMapper resourcePurchaseMapper;
    private final UserAccountMapper userAccountMapper;
    private final PostMapper postMapper;

    public List<WalletLedgerItemResponse> listWalletLedger(Long userId, String bizType, Integer limit) {
        int resolvedLimit = limit == null || limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        List<WalletLedgerEntity> items = walletLedgerMapper.selectList(new LambdaQueryWrapper<WalletLedgerEntity>()
                .eq(userId != null, WalletLedgerEntity::getUserId, userId)
                .eq(bizType != null && !bizType.isBlank(), WalletLedgerEntity::getBizType,
                        bizType == null ? null : bizType.trim().toUpperCase())
                .orderByDesc(WalletLedgerEntity::getCreatedAt)
                .last("LIMIT " + resolvedLimit));
        return items.stream().map(item -> {
            WalletLedgerItemResponse response = new WalletLedgerItemResponse();
            response.setId(item.getId());
            response.setDirection(item.getDirection());
            response.setChangeAmount(item.getChangeAmount());
            response.setBalanceAfter(item.getBalanceAfter());
            response.setFrozenAfter(item.getFrozenAfter());
            response.setBizType(item.getBizType());
            response.setRemark(item.getRemark());
            response.setOperatedBy(item.getOperatedBy());
            response.setCreatedAt(item.getCreatedAt());
            return response;
        }).toList();
    }

    public List<ResourceTradeAuditItemResponse> listResourceTrades(Long userId, Long postId, Integer limit) {
        int resolvedLimit = limit == null || limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        List<ResourcePurchaseEntity> purchases = resourcePurchaseMapper
                .selectList(new LambdaQueryWrapper<ResourcePurchaseEntity>()
                        .and(userId != null, wrapper -> wrapper
                                .eq(ResourcePurchaseEntity::getBuyerId, userId)
                                .or()
                                .eq(ResourcePurchaseEntity::getSellerId, userId))
                        .eq(postId != null, ResourcePurchaseEntity::getPostId, postId)
                        .orderByDesc(ResourcePurchaseEntity::getCreatedAt)
                        .last("LIMIT " + resolvedLimit));
        if (purchases.isEmpty()) {
            return List.of();
        }

        Map<Long, PostEntity> postMap = postMapper.selectList(new LambdaQueryWrapper<PostEntity>()
                .in(PostEntity::getId,
                        purchases.stream().map(ResourcePurchaseEntity::getPostId).collect(Collectors.toSet())))
                .stream()
                .collect(Collectors.toMap(PostEntity::getId, item -> item));
        Set<Long> userIds = purchases.stream()
                .flatMap(item -> java.util.stream.Stream.of(item.getBuyerId(), item.getSellerId()))
                .collect(Collectors.toSet());
        Map<Long, UserAccountEntity> userMap = userAccountMapper.selectList(new LambdaQueryWrapper<UserAccountEntity>()
                .in(UserAccountEntity::getId, userIds)).stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, item -> item));

        return purchases.stream().map(item -> {
            ResourceTradeAuditItemResponse response = new ResourceTradeAuditItemResponse();
            response.setPurchaseId(item.getId());
            response.setPostId(item.getPostId());
            response.setPostTitle(
                    postMap.get(item.getPostId()) == null ? null : postMap.get(item.getPostId()).getTitle());
            response.setBuyerId(item.getBuyerId());
            response.setBuyerUsername(
                    userMap.get(item.getBuyerId()) == null ? null : userMap.get(item.getBuyerId()).getUsername());
            response.setSellerId(item.getSellerId());
            response.setSellerUsername(
                    userMap.get(item.getSellerId()) == null ? null : userMap.get(item.getSellerId()).getUsername());
            response.setPrice(item.getPrice());
            response.setRefundedAmount(item.getRefundedAmount());
            response.setStatus(item.getStatus());
            response.setCreatedAt(item.getCreatedAt());
            response.setUpdatedAt(item.getUpdatedAt());
            return response;
        }).toList();
    }
}
