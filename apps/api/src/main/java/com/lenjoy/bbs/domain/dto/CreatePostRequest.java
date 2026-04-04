package com.lenjoy.bbs.domain.dto;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import com.lenjoy.bbs.domain.enums.PostType;
import io.swagger.v3.oas.annotations.media.DiscriminatorMapping;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;
import lombok.Data;

@Data
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.EXISTING_PROPERTY, property = "postType",
        visible = true)
@JsonSubTypes({
        @JsonSubTypes.Type(value = CreateNormalPostRequest.class, name = "NORMAL"),
        @JsonSubTypes.Type(value = CreateResourcePostRequest.class, name = "RESOURCE"),
        @JsonSubTypes.Type(value = CreateBountyPostRequest.class, name = "BOUNTY")
})
@Schema(
        description = "Create post request. Use different fields based on postType.",
        discriminatorProperty = "postType",
        discriminatorMapping = {
                @DiscriminatorMapping(value = "NORMAL", schema = CreateNormalPostRequest.class),
                @DiscriminatorMapping(value = "RESOURCE", schema = CreateResourcePostRequest.class),
                @DiscriminatorMapping(value = "BOUNTY", schema = CreateBountyPostRequest.class)
        },
        oneOf = {
                CreateNormalPostRequest.class,
                CreateResourcePostRequest.class,
                CreateBountyPostRequest.class
        })
public abstract class CreatePostRequest implements PostWritePayload {

    @NotNull(message = "Post type is required")
    @Schema(description = "Post type", requiredMode = Schema.RequiredMode.REQUIRED,
            allowableValues = { "NORMAL", "RESOURCE", "BOUNTY" }, example = "NORMAL")
    private PostType postType;

    @NotBlank(message = "Title is required")
    @Schema(description = "Post title", requiredMode = Schema.RequiredMode.REQUIRED, example = "Need help with Redis cluster failover")
    private String title;

    @NotNull(message = "Category is required")
    @Schema(description = "Category ID for the selected post type", requiredMode = Schema.RequiredMode.REQUIRED,
            example = "1")
    private Long categoryId;

    @Schema(description = "Tag ID list", example = "[10, 20]")
    private List<Long> tagIds;
}
