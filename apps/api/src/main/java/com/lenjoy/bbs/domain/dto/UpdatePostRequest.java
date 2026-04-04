package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import java.util.List;
import lombok.Data;

@Data
public class UpdatePostRequest implements PostWritePayload {

    @NotBlank(message = "Title is required")
    @Schema(description = "Post title", requiredMode = Schema.RequiredMode.REQUIRED)
    private String title;

    @NotNull(message = "Category is required")
    @Schema(description = "Category ID", requiredMode = Schema.RequiredMode.REQUIRED)
    private Long categoryId;

    @Schema(description = "Tag ID list")
    private List<Long> tagIds;

    @Schema(description = "Public post content")
    private String content;

    @Schema(description = "Hidden resource content")
    private String hiddenContent;

    @Schema(description = "Price in coins")
    private Integer price;

    @Schema(description = "Bounty amount in coins")
    private Integer bountyAmount;

    @Schema(description = "Bounty deadline")
    private LocalDateTime bountyExpireAt;
}
