package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class OpenApiClientResponse {

    private Long id;
    private String name;
    private String apiKeyMasked;
    private String apiKeyPlaintext;
    private String status;
    private String remark;
    private Integer bindingCount;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
