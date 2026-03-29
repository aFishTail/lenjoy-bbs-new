package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.dto.PostCommentResponse;
import com.lenjoy.bbs.domain.entity.PostCommentEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostCommentMapper;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class CommentServiceTest {

    @Mock
    private PostCommentMapper postCommentMapper;

    @Mock
    private PostMapper postMapper;

    @Mock
    private UserAccountMapper userAccountMapper;

    @Mock
    private BountyService bountyService;

    @InjectMocks
    private CommentService commentService;

    @Test
    void create_whenBountyAuthorPostsRootAnswer_shouldThrowInvalidOperation() {
        PostEntity post = buildPost(10L, "BOUNTY", 1L);
        post.setBountyStatus(BountyService.BOUNTY_STATUS_ACTIVE);
        UserAccountEntity author = buildUser(1L, "ACTIVE");

        when(postMapper.selectById(10L)).thenReturn(post);
        when(userAccountMapper.selectById(1L)).thenReturn(author);

        ApiException ex = assertThrows(ApiException.class, () -> commentService.create(10L, 1L, "answer", null));

        assertEquals("INVALID_OPERATION", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(postCommentMapper, never()).insert(any(PostCommentEntity.class));
    }

    @Test
    void create_whenReplyToSecondLevel_shouldThrowDepthInvalid() {
        PostEntity post = buildPost(10L, "NORMAL", 1L);
        UserAccountEntity replier = buildUser(2L, "ACTIVE");

        PostCommentEntity secondLevel = new PostCommentEntity();
        secondLevel.setId(999L);
        secondLevel.setPostId(10L);
        secondLevel.setParentId(100L);
        secondLevel.setAuthorId(3L);

        when(postMapper.selectById(10L)).thenReturn(post);
        when(userAccountMapper.selectById(2L)).thenReturn(replier);
        when(postCommentMapper.selectById(999L)).thenReturn(secondLevel);

        ApiException ex = assertThrows(ApiException.class, () -> commentService.create(10L, 2L, "reply", 999L));

        assertEquals("COMMENT_DEPTH_INVALID", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(postCommentMapper, never()).insert(any(PostCommentEntity.class));
    }

    @Test
    void create_whenReplyToRoot_shouldSetReplyToUserAndReturnInsertedComment() {
        PostEntity post = buildPost(10L, "NORMAL", 1L);
        UserAccountEntity replier = buildUser(2L, "ACTIVE");

        PostCommentEntity root = new PostCommentEntity();
        root.setId(100L);
        root.setPostId(10L);
        root.setParentId(null);
        root.setAuthorId(1L);
        root.setContent("root");
        root.setDeleted(false);
        root.setAccepted(false);
        root.setCreatedAt(LocalDateTime.now().minusMinutes(1));
        root.setUpdatedAt(LocalDateTime.now().minusMinutes(1));

        PostCommentEntity[] insertedHolder = new PostCommentEntity[1];
        doAnswer(invocation -> {
            PostCommentEntity entity = invocation.getArgument(0);
            entity.setId(101L);
            insertedHolder[0] = entity;
            return 1;
        }).when(postCommentMapper).insert(any(PostCommentEntity.class));

        when(postMapper.selectById(10L)).thenReturn(post);
        when(userAccountMapper.selectById(2L)).thenReturn(replier);
        when(postCommentMapper.selectById(100L)).thenReturn(root);

        when(postCommentMapper.selectList(any())).thenAnswer(invocation -> {
            PostCommentEntity inserted = insertedHolder[0];
            inserted.setCreatedAt(LocalDateTime.now());
            inserted.setUpdatedAt(LocalDateTime.now());
            return List.of(root, inserted);
        });

        UserAccountEntity user1 = buildUser(1L, "ACTIVE");
        user1.setUsername("author");
        replier.setUsername("replier");
        when(userAccountMapper.selectList(any())).thenReturn(List.of(user1, replier));

        PostCommentResponse response = commentService.create(10L, 2L, "reply content", 100L);

        assertEquals(101L, response.getId());
        assertEquals(100L, response.getParentId());
        assertEquals(1L, response.getReplyToUserId());
        assertEquals("replier", response.getAuthorUsername());
        assertEquals("author", response.getReplyToUsername());
    }

    private PostEntity buildPost(Long postId, String postType, Long authorId) {
        PostEntity post = new PostEntity();
        post.setId(postId);
        post.setPostType(postType);
        post.setAuthorId(authorId);
        post.setDeleted(false);
        post.setStatus("PUBLISHED");
        return post;
    }

    private UserAccountEntity buildUser(Long id, String status) {
        UserAccountEntity user = new UserAccountEntity();
        user.setId(id);
        user.setStatus(status);
        return user;
    }
}
