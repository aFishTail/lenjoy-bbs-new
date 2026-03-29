package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface UserAccountMapper extends BaseMapper<UserAccountEntity> {

    @Select("SELECT id, username, email, phone, avatar_url, bio, password_hash, status, created_at, updated_at FROM user_account WHERE username = #{username} LIMIT 1")
    UserAccountEntity selectByUsername(String username);
}