package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.PostLikeEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PostLikeMapper extends BaseMapper<PostLikeEntity> {

    @Select("SELECT id, post_id, user_id, created_at FROM post_like WHERE post_id = #{postId} AND user_id = #{userId} LIMIT 1")
    PostLikeEntity selectByPostIdAndUserId(Long postId, Long userId);

    @Select("SELECT COUNT(1) FROM post_like WHERE post_id = #{postId}")
    long countByPostId(Long postId);
}
