package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.PostEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface PostMapper extends BaseMapper<PostEntity> {
}
