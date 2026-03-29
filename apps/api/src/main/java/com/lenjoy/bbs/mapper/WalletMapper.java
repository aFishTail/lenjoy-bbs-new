package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.WalletEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface WalletMapper extends BaseMapper<WalletEntity> {

    @Select("SELECT id, user_id, available_coins, frozen_coins, created_at, updated_at FROM wallet WHERE user_id = #{userId} FOR UPDATE")
    WalletEntity selectByUserIdForUpdate(Long userId);
}