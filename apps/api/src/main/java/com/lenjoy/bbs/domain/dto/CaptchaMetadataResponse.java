package com.lenjoy.bbs.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CaptchaMetadataResponse {

    private String captchaId;
    private String imageUrl;
    private long expireAt;
}