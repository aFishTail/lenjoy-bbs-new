package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.WalletLedgerEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface WalletLedgerMapper extends BaseMapper<WalletLedgerEntity> {

    @Select("SELECT id, wallet_id, user_id, direction, change_amount, balance_after, frozen_after, biz_type, biz_key, remark, operated_by, created_at FROM wallet_ledger WHERE biz_key = #{bizKey} LIMIT 1")
    WalletLedgerEntity selectByBizKey(String bizKey);

    @Select("SELECT COALESCE(SUM(change_amount), 0) FROM wallet_ledger WHERE direction = #{direction}")
    long sumChangeAmountByDirection(String direction);
}