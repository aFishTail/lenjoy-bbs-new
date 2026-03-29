package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.UserFollowEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserFollowMapper extends BaseMapper<UserFollowEntity> {

    @Select("SELECT id, follower_id, following_id, created_at FROM user_follow WHERE follower_id = #{followerId} AND following_id = #{followingId} LIMIT 1")
    UserFollowEntity selectByFollowerAndFollowing(Long followerId, Long followingId);

    @Select("SELECT COUNT(1) FROM user_follow WHERE following_id = #{userId}")
    long countFollowersByUserId(Long userId);

    @Select("SELECT COUNT(1) FROM user_follow WHERE follower_id = #{userId}")
    long countFollowingByUserId(Long userId);
}
