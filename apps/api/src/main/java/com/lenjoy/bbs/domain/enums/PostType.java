package com.lenjoy.bbs.domain.enums;

import com.lenjoy.bbs.exception.ApiException;
import java.util.Arrays;
import org.springframework.http.HttpStatus;

public enum PostType {
    NORMAL,
    RESOURCE,
    BOUNTY;

    public static PostType fromNullable(String value) {
        if (value == null || value.isBlank()) {
            throw new ApiException("POST_TYPE_INVALID", "帖子类型不合法", HttpStatus.BAD_REQUEST);
        }
        return Arrays.stream(values())
                .filter(type -> type.name().equalsIgnoreCase(value.trim()))
                .findFirst()
                .orElseThrow(() -> new ApiException("POST_TYPE_INVALID", "帖子类型不合法", HttpStatus.BAD_REQUEST));
    }

    public String value() {
        return name();
    }
}
