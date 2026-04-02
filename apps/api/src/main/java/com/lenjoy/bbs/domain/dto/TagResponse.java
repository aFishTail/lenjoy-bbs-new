package com.lenjoy.bbs.domain.dto;

import lombok.Data;

@Data
public class TagResponse {

    private Long id;
    private String name;
    private String slug;
    private String status;
    private String source;
    private Long usageCount;
}
