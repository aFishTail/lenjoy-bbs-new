package com.lenjoy.bbs.service;

import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.PostWritePayload;
import com.lenjoy.bbs.domain.enums.PostType;
import java.time.LocalDateTime;
import java.util.List;

public record PostCreateCommand(
        Long authorId,
        PostType postType,
        String title,
        Long categoryId,
        List<Long> tagIds,
        String content,
        String hiddenContent,
        Integer price,
        Integer bountyAmount,
        LocalDateTime bountyExpireAt) implements PostWritePayload {

    public static PostCreateCommand from(Long authorId, CreatePostRequest request) {
        return new PostCreateCommand(
                authorId,
                request.getPostType(),
                request.getTitle(),
                request.getCategoryId(),
                request.getTagIds(),
                request.getContent(),
                request.getHiddenContent(),
                request.getPrice(),
                request.getBountyAmount(),
                request.getBountyExpireAt());
    }

    @Override
    public String getTitle() {
        return title;
    }

    @Override
    public Long getCategoryId() {
        return categoryId;
    }

    @Override
    public List<Long> getTagIds() {
        return tagIds;
    }

    @Override
    public String getContent() {
        return content;
    }

    @Override
    public String getHiddenContent() {
        return hiddenContent;
    }

    @Override
    public Integer getPrice() {
        return price;
    }

    @Override
    public Integer getBountyAmount() {
        return bountyAmount;
    }

    @Override
    public LocalDateTime getBountyExpireAt() {
        return bountyExpireAt;
    }
}
