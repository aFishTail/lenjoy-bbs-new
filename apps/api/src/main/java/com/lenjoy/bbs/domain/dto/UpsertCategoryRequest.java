package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpsertCategoryRequest {

    @NotBlank(message = "Category name is required")
    private String name;

    @NotBlank(message = "Content type is required")
    private String contentType;

    @NotNull(message = "Parent id is required")
    private Long parentId;

    private Integer sort;

    private Boolean leaf;
}
