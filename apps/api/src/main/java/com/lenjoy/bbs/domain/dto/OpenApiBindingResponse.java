package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class OpenApiBindingResponse {

    private Long id;
    private Long clientId;
    private String bindingCode;
    private String status;
    private String remark;
    private Long userId;
    private String username;
    private String email;
    private String phone;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
