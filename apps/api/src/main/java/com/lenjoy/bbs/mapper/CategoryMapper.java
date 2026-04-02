package com.lenjoy.bbs.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.lenjoy.bbs.domain.entity.CategoryEntity;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface CategoryMapper extends BaseMapper<CategoryEntity> {
}
