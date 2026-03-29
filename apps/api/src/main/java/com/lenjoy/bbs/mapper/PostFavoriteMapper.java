package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.PostFavoriteEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PostFavoriteMapper extends BaseMapper<PostFavoriteEntity> {

    @Select("SELECT id, post_id, user_id, created_at FROM post_favorite WHERE post_id = #{postId} AND user_id = #{userId} LIMIT 1")
    PostFavoriteEntity selectByPostIdAndUserId(Long postId, Long userId);

    @Select("SELECT COUNT(1) FROM post_favorite WHERE post_id = #{postId}")
    long countByPostId(Long postId);
}
