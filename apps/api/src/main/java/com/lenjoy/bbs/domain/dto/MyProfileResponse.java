package com.lenjoy.bbs.domain.dto;

import lombok.Data;

@Data
public class MyProfileResponse {

    private Long id;
    private String username;
    private String email;
    private String phone;
    private String avatarUrl;
    private String bio;
    private long postCount;
    private long followingCount;
    private long followerCount;
}
