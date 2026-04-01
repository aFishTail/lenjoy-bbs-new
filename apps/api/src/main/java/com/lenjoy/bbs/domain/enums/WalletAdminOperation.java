package com.lenjoy.bbs.domain.enums;

import com.lenjoy.bbs.exception.ApiException;
import java.util.Arrays;
import org.springframework.http.HttpStatus;

public enum WalletAdminOperation {
    CREDIT,
    DEBIT;

    public static WalletAdminOperation fromNullable(String value) {
        if (value == null || value.isBlank()) {
            throw new ApiException("INVALID_OPERATION", "金币操作类型不支持", HttpStatus.BAD_REQUEST);
        }
        return Arrays.stream(values())
                .filter(operation -> operation.name().equalsIgnoreCase(value.trim()))
                .findFirst()
                .orElseThrow(() -> new ApiException("INVALID_OPERATION", "金币操作类型不支持", HttpStatus.BAD_REQUEST));
    }
}
