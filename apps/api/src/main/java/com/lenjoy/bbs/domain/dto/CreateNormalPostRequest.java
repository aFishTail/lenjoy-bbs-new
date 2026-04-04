package com.lenjoy.bbs.domain.dto;

import com.lenjoy.bbs.domain.enums.PostType;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Schema(
        name = "CreateNormalPostRequest",
        description = "Create a normal discussion post.",
        example = """
                {
                  "postType": "NORMAL",
                  "title": "Need help with Redis cluster failover",
                  "categoryId": 1,
                  "tagIds": [10, 20],
                  "content": "Has anyone handled failover under burst traffic?"
                }
                """)
public class CreateNormalPostRequest extends CreatePostRequest {

    @Schema(description = "Public post content", requiredMode = Schema.RequiredMode.REQUIRED,
            example = "Has anyone handled failover under burst traffic?")
    private String content;

    public CreateNormalPostRequest() {
        setPostType(PostType.NORMAL);
    }

    @Override
    public String getHiddenContent() {
        return null;
    }

    @Override
    public Integer getPrice() {
        return null;
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
