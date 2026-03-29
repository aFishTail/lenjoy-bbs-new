package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.ResourceAppealEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ResourceAppealMapper extends BaseMapper<ResourceAppealEntity> {

    @Select("SELECT id, purchase_id, post_id, buyer_id, seller_id, reason, detail, status, requested_refund_amount, resolved_refund_amount, resolution_note, resolved_by, resolved_at, created_at, updated_at FROM resource_appeal WHERE purchase_id = #{purchaseId} LIMIT 1")
    ResourceAppealEntity selectByPurchaseId(Long purchaseId);
}