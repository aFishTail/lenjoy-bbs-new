package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import lombok.Data;

@Data
public class UserRelationResponse {

    private Long id;

    private String username;

    private String avatarUrl;

    private LocalDateTime followedAt;
}
