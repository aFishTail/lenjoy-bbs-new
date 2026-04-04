package com.lenjoy.bbs.domain.dto;

import com.lenjoy.bbs.domain.enums.PostType;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;
import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
@Schema(
        name = "CreateBountyPostRequest",
        description = "Create a bounty post.",
        example = """
                {
                  "postType": "BOUNTY",
                  "title": "Need a fix for PostgreSQL deadlock issue",
                  "categoryId": 3,
                  "tagIds": [40, 41],
                  "content": "Looking for a reproducible fix and explanation.",
                  "bountyAmount": 300,
                  "bountyExpireAt": "2026-04-30T18:00:00"
                }
                """)
public class CreateBountyPostRequest extends CreatePostRequest {

    @Schema(description = "Bounty description", requiredMode = Schema.RequiredMode.REQUIRED,
            example = "Looking for a reproducible fix and explanation.")
    private String content;

    @Schema(description = "Bounty amount in coins", requiredMode = Schema.RequiredMode.REQUIRED, example = "300")
    private Integer bountyAmount;

    @Schema(description = "Bounty deadline, must be in the future", requiredMode = Schema.RequiredMode.REQUIRED,
            example = "2026-04-30T18:00:00")
    private LocalDateTime bountyExpireAt;

    public CreateBountyPostRequest() {
        setPostType(PostType.BOUNTY);
    }

    @Override
    public String getHiddenContent() {
        return null;
    }

    @Override
    public Integer getPrice() {
        return null;
    }
}
