package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class UpsertTagRequest {

    @NotBlank(message = "Tag name is required")
    private String name;
}
