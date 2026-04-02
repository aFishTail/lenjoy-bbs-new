package com.lenjoy.bbs.domain.dto;

import java.util.List;
import lombok.Data;

@Data
public class AuthResponse {

    private String token;
    private String tokenType;
    private long expiresIn;
    private UserSummary user;

    @Data
    public static class UserSummary {
        private Long id;
        private String username;
        private String email;
        private String phone;
        private String avatarUrl;
        private String bio;
        private List<String> roles;
    }
}
