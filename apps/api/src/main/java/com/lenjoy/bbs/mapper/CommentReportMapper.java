package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.CommentReportEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CommentReportMapper extends BaseMapper<CommentReportEntity> {

    @Select("SELECT id, comment_id, reporter_id, reason, detail, status, resolution_note, handled_by, handled_at, created_at, updated_at FROM comment_report WHERE comment_id = #{commentId} AND reporter_id = #{reporterId} AND status = 'PENDING' LIMIT 1")
    CommentReportEntity selectPendingByCommentIdAndReporterId(Long commentId, Long reporterId);
}
