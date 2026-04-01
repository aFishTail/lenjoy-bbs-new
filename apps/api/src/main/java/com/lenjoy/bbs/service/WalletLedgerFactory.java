package com.lenjoy.bbs.service;

import com.lenjoy.bbs.domain.entity.WalletEntity;
import com.lenjoy.bbs.domain.entity.WalletLedgerEntity;
import com.lenjoy.bbs.domain.enums.WalletDirection;
import java.time.LocalDateTime;
import org.springframework.stereotype.Component;

@Component
public class WalletLedgerFactory {

    public WalletLedgerEntity create(
            WalletEntity wallet,
            Long userId,
            WalletDirection direction,
            int amount,
            int balanceAfter,
            int frozenAfter,
            String bizType,
            String bizKey,
            String remark,
            Long operatorUserId,
            LocalDateTime createdAt) {
        WalletLedgerEntity ledger = new WalletLedgerEntity();
        ledger.setWalletId(wallet.getId());
        ledger.setUserId(userId);
        ledger.setDirection(direction.value());
        ledger.setChangeAmount(amount);
        ledger.setBalanceAfter(balanceAfter);
        ledger.setFrozenAfter(frozenAfter);
        ledger.setBizType(bizType);
        ledger.setBizKey(blankToNull(bizKey));
        ledger.setRemark(blankToNull(remark));
        ledger.setOperatedBy(operatorUserId);
        ledger.setCreatedAt(createdAt);
        return ledger;
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
