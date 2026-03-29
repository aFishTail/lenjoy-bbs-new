package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import lombok.Data;

@Data
public class UpdatePostRequest {

    @NotBlank(message = "标题不能为空")
    private String title;

    private String content;

    private String hiddenContent;

    private Integer price;

    private Integer bountyAmount;

    private LocalDateTime bountyExpireAt;
}
