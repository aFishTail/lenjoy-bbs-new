package com.lenjoy.bbs.domain.enums;

import com.lenjoy.bbs.exception.ApiException;
import java.util.Arrays;
import org.springframework.http.HttpStatus;

public enum WalletDirection {
    INCOME,
    EXPENSE,
    FREEZE,
    UNFREEZE;

    public static WalletDirection from(String value) {
        return Arrays.stream(values())
                .filter(direction -> direction.name().equalsIgnoreCase(value))
                .findFirst()
                .orElseThrow(() -> new ApiException("INVALID_DIRECTION", "钱包流水方向不支持", HttpStatus.BAD_REQUEST));
    }

    public String value() {
        return name();
    }
}
