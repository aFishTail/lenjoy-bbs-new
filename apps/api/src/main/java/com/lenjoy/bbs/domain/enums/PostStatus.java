package com.lenjoy.bbs.domain.enums;

public enum PostStatus {
    PUBLISHED,
    CLOSED,
    OFFLINE,
    DELETED;

    public String value() {
        return name();
    }
}
