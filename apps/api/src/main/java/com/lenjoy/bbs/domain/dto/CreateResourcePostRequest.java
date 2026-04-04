package com.lenjoy.bbs.domain.dto;

import com.lenjoy.bbs.domain.enums.PostType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Schema(
        name = "CreateResourcePostRequest",
        description = "Create a paid resource post.",
        example = """
                {
                  "postType": "RESOURCE",
                  "title": "Spring Boot deployment checklist",
                  "categoryId": 2,
                  "tagIds": [30],
                  "content": "Public preview of the checklist.",
                  "hiddenContent": "Download link and source archive.",
                  "price": 99
                }
                """)
public class CreateResourcePostRequest extends CreatePostRequest {

    @Schema(description = "Public preview content", requiredMode = Schema.RequiredMode.REQUIRED,
            example = "Public preview of the checklist.")
    private String content;

    @Schema(description = "Hidden resource content shown after purchase",
            requiredMode = Schema.RequiredMode.REQUIRED, example = "Download link and source archive.")
    private String hiddenContent;

    @Schema(description = "Price in coins", requiredMode = Schema.RequiredMode.REQUIRED, example = "99")
    private Integer price;

    public CreateResourcePostRequest() {
        setPostType(PostType.RESOURCE);
    }

    @Override
    public Integer getBountyAmount() {
        return null;
    }

    @Override
    public java.time.LocalDateTime getBountyExpireAt() {
        return null;
    }
}
