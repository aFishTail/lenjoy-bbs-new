package com.lenjoy.bbs.domain.dto;

import lombok.Data;

@Data
public class ToggleInteractionResponse {

    private boolean active;

    private long count;
}
