package com.lenjoy.bbs.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateMyProfileRequest {

    @NotBlank(message = "昵称不能为空")
    @Size(min = 2, max = 20, message = "昵称长度需为 2-20 个字符")
    @Pattern(regexp = "^[\\p{IsHan}A-Za-z0-9_]+$", message = "昵称仅支持中文、字母、数字和下划线")
    private String username;

    @Size(max = 512, message = "头像地址过长")
    private String avatarUrl;

    @Size(max = 200, message = "简介最多 200 字")
    private String bio;
}
