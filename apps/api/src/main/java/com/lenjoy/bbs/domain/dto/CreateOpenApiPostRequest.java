package com.lenjoy.bbs.domain.dto;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@JsonTypeInfo(use = JsonTypeInfo.Id.NONE)
public class CreateOpenApiPostRequest extends CreatePostRequest {

    @NotBlank(message = "Author binding code is required")
    private String authorBindingCode;

    private String content;

    private String hiddenContent;

    private Integer price;

    private Integer bountyAmount;

    private LocalDateTime bountyExpireAt;
}
