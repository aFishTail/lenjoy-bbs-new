package com.lenjoy.bbs.domain.dto;

import java.time.LocalDateTime;
import java.util.List;
import lombok.Data;

@Data
public class PostCommentResponse {

    private Long id;

    private Long postId;

    private Long authorId;

    private String authorUsername;

    private Long parentId;

    private Long replyToUserId;

    private String replyToUsername;

    private String content;

    private Boolean accepted;

    private Boolean deleted;

    private String deletedReason;

    private Long likeCount;

    private Boolean liked;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private List<PostCommentResponse> replies;
}