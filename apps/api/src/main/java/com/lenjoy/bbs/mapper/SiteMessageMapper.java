package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.SiteMessageEntity;
import java.time.LocalDateTime;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SiteMessageMapper extends BaseMapper<SiteMessageEntity> {

    @Select("SELECT COUNT(1) FROM site_message WHERE user_id = #{userId} AND is_read = FALSE")
    int countUnreadByUserId(Long userId);

    @Select("SELECT id, user_id, message_type, title, content, biz_type, biz_id, related_post_id, related_purchase_id, related_appeal_id, is_read, read_at, created_at, updated_at FROM site_message WHERE user_id = #{userId} AND message_type = #{messageType} AND ((related_post_id IS NULL AND #{relatedPostId} IS NULL) OR related_post_id = #{relatedPostId}) AND is_read = FALSE AND created_at >= #{fromTime} ORDER BY created_at DESC LIMIT 1")
    SiteMessageEntity selectLatestAggregatable(Long userId, String messageType, Long relatedPostId,
            LocalDateTime fromTime);
}