package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Data;

@Data
public class AdminUserSummaryResponse {

    private Long id;

    private String username;

    private String email;

    private String phone;

    private String status;

    private List<String> roles;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;
}
