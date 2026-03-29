package com.lenjoy.bbs.domain.dto;

import lombok.Data;

@Data
public class ToggleFollowResponse {

    private boolean following;

    private long followerCount;

    private long followingCount;
}
