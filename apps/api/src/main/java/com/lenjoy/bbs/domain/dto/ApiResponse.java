package com.lenjoy.bbs.domain.dto;

import lombok.Data;

@Data
public class ApiResponse<T> {

    private boolean success;
    private String code;
    private String message;
    private T data;

    public static <T> ApiResponse<T> ok(T data) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.success = true;
        resp.code = "OK";
        resp.message = "成功";
        resp.data = data;
        return resp;
    }

    public static <T> ApiResponse<T> fail(String code, String message) {
        ApiResponse<T> resp = new ApiResponse<>();
        resp.success = false;
        resp.code = code;
        resp.message = message;
        return resp;
    }
}