package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import java.util.List;

public interface PostWritePayload {

    String getTitle();

    Long getCategoryId();

    List<Long> getTagIds();

    String getContent();

    String getHiddenContent();

    Integer getPrice();

    Integer getBountyAmount();

    LocalDateTime getBountyExpireAt();
}
