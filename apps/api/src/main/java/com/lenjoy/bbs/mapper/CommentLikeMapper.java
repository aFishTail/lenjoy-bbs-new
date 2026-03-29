package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.CommentLikeEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface CommentLikeMapper extends BaseMapper<CommentLikeEntity> {

    @Select("SELECT id, comment_id, user_id, created_at FROM comment_like WHERE comment_id = #{commentId} AND user_id = #{userId} LIMIT 1")
    CommentLikeEntity selectByCommentIdAndUserId(Long commentId, Long userId);

    @Select("SELECT COUNT(1) FROM comment_like WHERE comment_id = #{commentId}")
    long countByCommentId(Long commentId);
}
