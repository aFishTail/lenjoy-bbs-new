package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.AdminCoinUserSummaryResponse;
import com.lenjoy.bbs.domain.dto.UpdateUserCoinsRequest;
import com.lenjoy.bbs.domain.dto.WalletLedgerItemResponse;
import com.lenjoy.bbs.domain.dto.WalletSummaryResponse;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.entity.WalletEntity;
import com.lenjoy.bbs.domain.entity.WalletLedgerEntity;
import com.lenjoy.bbs.domain.enums.WalletAdminOperation;
import com.lenjoy.bbs.domain.enums.WalletDirection;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.WalletLedgerMapper;
import com.lenjoy.bbs.mapper.WalletMapper;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WalletService {

    private static final int MAX_LEDGER_LIMIT = 100;

    private final WalletMapper walletMapper;
    private final WalletLedgerMapper walletLedgerMapper;
    private final UserAccountMapper userAccountMapper;
    private final WalletLedgerFactory walletLedgerFactory;

    @Value("${wallet.initial-register-coins:100}")
    private int initialRegisterCoins;

    @Transactional
    public void grantRegisterBonus(Long userId) {
        adjustAvailableCoins(userId,
                WalletDirection.INCOME.value(),
                initialRegisterCoins,
                "REGISTER_BONUS",
                "register:" + userId,
                "注册赠送金币",
                null);
    }

    public WalletSummaryResponse getWalletSummary(Long userId) {
        WalletEntity wallet = getOrCreateWallet(userId);
        return toWalletSummary(wallet);
    }

    public List<WalletLedgerItemResponse> listLedger(Long userId, Integer limit) {
        requireUser(userId);
        int normalizedLimit = normalizeLedgerLimit(limit);
        return walletLedgerMapper.selectList(new LambdaQueryWrapper<WalletLedgerEntity>()
                .eq(WalletLedgerEntity::getUserId, userId)
                .orderByDesc(WalletLedgerEntity::getCreatedAt)
                .last("LIMIT " + normalizedLimit)).stream()
                .map(this::toLedgerItem)
                .toList();
    }

    public List<AdminCoinUserSummaryResponse> listAdminWalletUsers(String status, String keyword) {
        LambdaQueryWrapper<UserAccountEntity> query = new LambdaQueryWrapper<UserAccountEntity>()
                .orderByDesc(UserAccountEntity::getCreatedAt);

        if (status != null && !status.isBlank()) {
            query.eq(UserAccountEntity::getStatus, status.trim().toUpperCase());
        }
        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            query.and(wrapper -> wrapper
                    .like(UserAccountEntity::getUsername, trimmed)
                    .or()
                    .like(UserAccountEntity::getEmail, trimmed)
                    .or()
                    .like(UserAccountEntity::getPhone, trimmed));
        }

        List<UserAccountEntity> users = userAccountMapper.selectList(query);
        if (users.isEmpty()) {
            return List.of();
        }

        Set<Long> userIds = users.stream().map(UserAccountEntity::getId).collect(Collectors.toSet());
        Map<Long, WalletEntity> walletByUserId = walletMapper.selectList(new LambdaQueryWrapper<WalletEntity>()
                .in(WalletEntity::getUserId, userIds)).stream()
                .collect(Collectors.toMap(WalletEntity::getUserId, wallet -> wallet));

        return users.stream().map(user -> {
            WalletEntity wallet = walletByUserId.get(user.getId());
            AdminCoinUserSummaryResponse response = new AdminCoinUserSummaryResponse();
            response.setId(user.getId());
            response.setUsername(user.getUsername());
            response.setEmail(user.getEmail());
            response.setPhone(user.getPhone());
            response.setStatus(user.getStatus());
            response.setAvailableCoins(wallet == null ? 0 : wallet.getAvailableCoins());
            response.setFrozenCoins(wallet == null ? 0 : wallet.getFrozenCoins());
            response.setTotalCoins(response.getAvailableCoins() + response.getFrozenCoins());
            response.setCreatedAt(user.getCreatedAt());
            response.setUpdatedAt(user.getUpdatedAt());
            return response;
        }).toList();
    }

    @Transactional
    public WalletSummaryResponse adjustCoinsByAdmin(Long targetUserId, Long operatorUserId,
            UpdateUserCoinsRequest request) {
        requireUser(targetUserId);
        if (targetUserId.equals(operatorUserId)) {
            throw new ApiException("INVALID_OPERATION", "不可调整自己的金币", HttpStatus.BAD_REQUEST);
        }

        WalletAdminOperation operation = WalletAdminOperation.fromNullable(request.getOperation());
        String bizKey = "admin:" + operatorUserId + ":" + targetUserId + ":" + operation.name() + ":"
                + request.getAmount() + ":" + request.getReason().trim() + ":" + System.currentTimeMillis();

        return switch (operation) {
            case CREDIT -> adjustAvailableCoins(targetUserId,
                    WalletDirection.INCOME.value(),
                    request.getAmount(),
                    "ADMIN_CREDIT",
                    bizKey,
                    request.getReason().trim(),
                    operatorUserId);
            case DEBIT -> adjustAvailableCoins(targetUserId,
                    WalletDirection.EXPENSE.value(),
                    request.getAmount(),
                    "ADMIN_DEBIT",
                    bizKey,
                    request.getReason().trim(),
                    operatorUserId);
        };
    }

    @Transactional
    public WalletSummaryResponse adjustAvailableCoins(
            Long userId,
            String direction,
            int amount,
            String bizType,
            String bizKey,
            String remark,
            Long operatorUserId) {
        requireUser(userId);
        validatePositiveAmount(amount);

        WalletLedgerEntity existing = findExistingLedger(bizKey);
        if (existing != null) {
            return getWalletSummary(userId);
        }

        WalletEntity wallet = getOrCreateWalletForUpdate(userId);
        int currentAvailable = safeCoins(wallet.getAvailableCoins());
        int currentFrozen = safeCoins(wallet.getFrozenCoins());
        WalletDirection walletDirection = WalletDirection.from(direction);
        int nextAvailable = switch (walletDirection) {
            case INCOME -> currentAvailable + amount;
            case EXPENSE -> currentAvailable - amount;
            default -> throw new ApiException("INVALID_DIRECTION", "钱包流水方向不支持", HttpStatus.BAD_REQUEST);
        };

        if (nextAvailable < 0) {
            throw new ApiException("COINS_NOT_ENOUGH", "金币余额不足", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime now = LocalDateTime.now();
        wallet.setAvailableCoins(nextAvailable);
        wallet.setFrozenCoins(currentFrozen);
        wallet.setUpdatedAt(now);
        walletMapper.updateById(wallet);

        walletLedgerMapper.insert(walletLedgerFactory.create(wallet, userId, walletDirection, amount, nextAvailable,
                currentFrozen, bizType, bizKey, remark, operatorUserId, now));

        return toWalletSummary(wallet);
    }

    @Transactional
    public WalletSummaryResponse freezeCoins(
            Long userId,
            int amount,
            String bizType,
            String bizKey,
            String remark,
            Long operatorUserId) {
        requireUser(userId);
        validatePositiveAmount(amount);

        WalletLedgerEntity existing = findExistingLedger(bizKey);
        if (existing != null) {
            return getWalletSummary(userId);
        }

        WalletEntity wallet = getOrCreateWalletForUpdate(userId);
        int currentAvailable = safeCoins(wallet.getAvailableCoins());
        int currentFrozen = safeCoins(wallet.getFrozenCoins());
        int nextAvailable = currentAvailable - amount;
        int nextFrozen = currentFrozen + amount;
        if (nextAvailable < 0) {
            throw new ApiException("COINS_NOT_ENOUGH", "金币余额不足", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime now = LocalDateTime.now();
        wallet.setAvailableCoins(nextAvailable);
        wallet.setFrozenCoins(nextFrozen);
        wallet.setUpdatedAt(now);
        walletMapper.updateById(wallet);

        walletLedgerMapper.insert(walletLedgerFactory.create(wallet, userId, WalletDirection.FREEZE, amount,
                nextAvailable, nextFrozen, bizType, bizKey, remark, operatorUserId, now));

        return toWalletSummary(wallet);
    }

    @Transactional
    public WalletSummaryResponse unfreezeCoins(
            Long userId,
            int amount,
            String bizType,
            String bizKey,
            String remark,
            Long operatorUserId) {
        requireUser(userId);
        validatePositiveAmount(amount);

        WalletLedgerEntity existing = findExistingLedger(bizKey);
        if (existing != null) {
            return getWalletSummary(userId);
        }

        WalletEntity wallet = getOrCreateWalletForUpdate(userId);
        int currentAvailable = safeCoins(wallet.getAvailableCoins());
        int currentFrozen = safeCoins(wallet.getFrozenCoins());
        int nextAvailable = currentAvailable + amount;
        int nextFrozen = currentFrozen - amount;
        if (nextFrozen < 0) {
            throw new ApiException("FROZEN_COINS_NOT_ENOUGH", "冻结金币不足", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime now = LocalDateTime.now();
        wallet.setAvailableCoins(nextAvailable);
        wallet.setFrozenCoins(nextFrozen);
        wallet.setUpdatedAt(now);
        walletMapper.updateById(wallet);

        walletLedgerMapper.insert(walletLedgerFactory.create(wallet, userId, WalletDirection.UNFREEZE, amount,
                nextAvailable, nextFrozen, bizType, bizKey, remark, operatorUserId, now));

        return toWalletSummary(wallet);
    }

    private WalletEntity getOrCreateWallet(Long userId) {
        requireUser(userId);
        WalletEntity wallet = walletMapper.selectOne(new LambdaQueryWrapper<WalletEntity>()
                .eq(WalletEntity::getUserId, userId));
        if (wallet != null) {
            return wallet;
        }

        WalletEntity created = new WalletEntity();
        created.setUserId(userId);
        created.setAvailableCoins(0);
        created.setFrozenCoins(0);
        walletMapper.insert(created);
        return created;
    }

    private WalletEntity getOrCreateWalletForUpdate(Long userId) {
        WalletEntity wallet = walletMapper.selectByUserIdForUpdate(userId);
        if (wallet != null) {
            return wallet;
        }
        getOrCreateWallet(userId);
        WalletEntity lockedWallet = walletMapper.selectByUserIdForUpdate(userId);
        if (lockedWallet == null) {
            throw new ApiException("WALLET_INIT_FAILED", "钱包初始化失败", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return lockedWallet;
    }

    private UserAccountEntity requireUser(Long userId) {
        UserAccountEntity user = userAccountMapper.selectById(userId);
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private WalletSummaryResponse toWalletSummary(WalletEntity wallet) {
        WalletSummaryResponse response = new WalletSummaryResponse();
        int availableCoins = safeCoins(wallet.getAvailableCoins());
        int frozenCoins = safeCoins(wallet.getFrozenCoins());
        response.setAvailableCoins(availableCoins);
        response.setFrozenCoins(frozenCoins);
        response.setTotalCoins(availableCoins + frozenCoins);
        response.setUpdatedAt(wallet.getUpdatedAt());
        return response;
    }

    private WalletLedgerItemResponse toLedgerItem(WalletLedgerEntity ledger) {
        WalletLedgerItemResponse response = new WalletLedgerItemResponse();
        response.setId(ledger.getId());
        response.setDirection(ledger.getDirection());
        response.setChangeAmount(ledger.getChangeAmount());
        response.setBalanceAfter(ledger.getBalanceAfter());
        response.setFrozenAfter(ledger.getFrozenAfter());
        response.setBizType(ledger.getBizType());
        response.setRemark(ledger.getRemark());
        response.setOperatedBy(ledger.getOperatedBy());
        response.setCreatedAt(ledger.getCreatedAt());
        return response;
    }

    private int normalizeLedgerLimit(Integer limit) {
        if (limit == null) {
            return 50;
        }
        if (limit < 1 || limit > MAX_LEDGER_LIMIT) {
            throw new ApiException("INVALID_LIMIT", "流水数量范围为 1-100", HttpStatus.BAD_REQUEST);
        }
        return limit;
    }

    private void validatePositiveAmount(int amount) {
        if (amount <= 0) {
            throw new ApiException("INVALID_AMOUNT", "金币数量必须大于 0", HttpStatus.BAD_REQUEST);
        }
    }

    private WalletLedgerEntity findExistingLedger(String bizKey) {
        if (bizKey == null || bizKey.isBlank()) {
            return null;
        }
        return walletLedgerMapper.selectByBizKey(bizKey);
    }

    private int safeCoins(Integer value) {
        return value == null ? 0 : value;
    }
}
