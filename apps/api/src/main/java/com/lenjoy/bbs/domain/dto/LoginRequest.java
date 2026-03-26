package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginRequest {

    @NotBlank
    private String account;

    @NotBlank
    private String password;

    @NotBlank
    private String captchaId;

    @NotBlank
    private String captchaCode;
}