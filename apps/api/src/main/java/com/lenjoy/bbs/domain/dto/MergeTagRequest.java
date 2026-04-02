package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MergeTagRequest {

    @NotNull(message = "Target tag id is required")
    private Long targetTagId;
}
