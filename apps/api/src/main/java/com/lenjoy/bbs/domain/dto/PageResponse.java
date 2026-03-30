package com.lenjoy.bbs.domain.dto;

import java.util.List;
import lombok.Data;

@Data
public class PageResponse<T> {

    private List<T> items;
    private long page;
    private long pageSize;
    private long total;
    private long totalPages;
    private boolean hasNext;
    private boolean hasPrevious;
}
