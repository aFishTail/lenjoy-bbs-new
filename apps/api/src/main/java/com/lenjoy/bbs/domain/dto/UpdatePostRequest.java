package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Data;

@Data
public class UpdatePostRequest {

    @NotBlank(message = "Title is required")
    private String title;

    @NotNull(message = "Category is required")
    private Long categoryId;

    private List<Long> tagIds;

    private String content;

    private String hiddenContent;

    private Integer price;

    private Integer bountyAmount;

    private LocalDateTime bountyExpireAt;
}
