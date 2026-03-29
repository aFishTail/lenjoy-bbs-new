package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.ResourcePurchaseEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ResourcePurchaseMapper extends BaseMapper<ResourcePurchaseEntity> {

    @Select("SELECT id, post_id, buyer_id, seller_id, price, refunded_amount, status, created_at, updated_at, refunded_at FROM resource_purchase WHERE post_id = #{postId} AND buyer_id = #{buyerId} LIMIT 1")
    ResourcePurchaseEntity selectByPostIdAndBuyerId(Long postId, Long buyerId);
}