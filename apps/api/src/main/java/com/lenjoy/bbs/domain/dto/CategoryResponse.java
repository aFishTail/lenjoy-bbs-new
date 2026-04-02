package com.lenjoy.bbs.domain.dto;

import lombok.Data;

@Data
public class CategoryResponse {

    private Long id;
    private String name;
    private String slug;
    private Long parentId;
    private String contentType;
    private Integer sort;
    private String status;
    private Boolean leaf;
}
