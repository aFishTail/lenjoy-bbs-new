package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.PostReportEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PostReportMapper extends BaseMapper<PostReportEntity> {

    @Select("SELECT id, post_id, reporter_id, reason, detail, status, resolution_note, handled_by, handled_at, created_at, updated_at FROM post_report WHERE post_id = #{postId} AND reporter_id = #{reporterId} AND status = 'PENDING' LIMIT 1")
    PostReportEntity selectPendingByPostIdAndReporterId(Long postId, Long reporterId);
}
