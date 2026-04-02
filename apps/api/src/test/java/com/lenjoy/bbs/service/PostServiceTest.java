package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.dto.CreatePostRequest;
import com.lenjoy.bbs.domain.dto.OfflinePostRequest;
import com.lenjoy.bbs.domain.dto.PostDetailResponse;
import com.lenjoy.bbs.domain.dto.PostSummaryResponse;
import com.lenjoy.bbs.domain.dto.UpdatePostRequest;
import com.lenjoy.bbs.domain.entity.CategoryEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.ResourcePurchaseMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class PostServiceTest {

    @Mock
    private PostMapper postMapper;

    @Mock
    private UserAccountMapper userAccountMapper;

    @Mock
    private ResourcePurchaseMapper resourcePurchaseMapper;

    @Mock
    private BountyService bountyService;

    @Mock
    private PostAssembler postAssembler;

    @Mock
    private TaxonomyService taxonomyService;

    @Spy
    private PostValidator postValidator;

    @InjectMocks
    private PostService postService;

    @Test
    void create_whenUserMuted_shouldThrowForbidden() {
        UserAccountEntity user = buildUser(1L, "author", "MUTED");
        when(userAccountMapper.selectById(1L)).thenReturn(user);

        CreatePostRequest request = new CreatePostRequest();
        request.setPostType("NORMAL");
        request.setTitle("hello");
        request.setCategoryId(1L);
        request.setContent("body");

        ApiException ex = assertThrows(ApiException.class, () -> postService.create(1L, request));

        assertEquals("USER_MUTED", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void update_whenNotAuthor_shouldThrowForbidden() {
        PostEntity post = buildPost(9L, 100L, "NORMAL", "PUBLISHED", false);
        when(postMapper.selectById(9L)).thenReturn(post);

        UpdatePostRequest request = new UpdatePostRequest();
        request.setTitle("new");
        request.setCategoryId(1L);
        request.setContent("new body");

        ApiException ex = assertThrows(ApiException.class, () -> postService.update(9L, 200L, request));

        assertEquals("FORBIDDEN", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void detail_whenOfflineAndVisitor_shouldHideAsNotFound() {
        PostEntity post = buildPost(11L, 1L, "NORMAL", "OFFLINE", false);
        when(postMapper.selectById(11L)).thenReturn(post);
        when(userAccountMapper.selectById(1L)).thenReturn(buildUser(1L, "author", "ACTIVE"));

        ApiException ex = assertThrows(ApiException.class, () -> postService.detail(11L, 2L, false));

        assertEquals("POST_NOT_FOUND", ex.getCode());
        assertEquals(HttpStatus.NOT_FOUND, ex.getHttpStatus());
    }

    @Test
    void delete_byAuthor_shouldMarkDeletedAndStatus() {
        PostEntity post = buildPost(21L, 7L, "NORMAL", "PUBLISHED", false);
        when(postMapper.selectById(21L)).thenReturn(post);

        postService.delete(21L, 7L);

        assertEquals("DELETED", post.getStatus());
        assertEquals(Boolean.TRUE, post.getDeleted());
        assertNotNull(post.getUpdatedAt());
        verify(postMapper).updateById(post);
    }

    @Test
    void delete_resourcePostWithPaidPurchases_shouldThrowBadRequest() {
        PostEntity post = buildPost(22L, 7L, "RESOURCE", "PUBLISHED", false);
        when(postMapper.selectById(22L)).thenReturn(post);
        when(resourcePurchaseMapper.selectCount(any())).thenReturn(1L);

        ApiException ex = assertThrows(ApiException.class, () -> postService.delete(22L, 7L));

        assertEquals("POST_HAS_PAID_PURCHASES", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }

    @Test
    void offline_whenAlreadyDeleted_shouldThrowBadRequest() {
        PostEntity post = buildPost(33L, 7L, "NORMAL", "DELETED", true);
        when(postMapper.selectById(33L)).thenReturn(post);

        OfflinePostRequest request = new OfflinePostRequest();
        request.setReason("invalid");

        ApiException ex = assertThrows(ApiException.class, () -> postService.offline(33L, 99L, request));

        assertEquals("POST_DELETED", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }

    @Test
    void listAdmin_whenAuthorFilterNoMatch_shouldReturnEmpty() {
        when(userAccountMapper.selectList(any())).thenReturn(List.of());

        var list = postService.listAdmin(null, null, "nobody", null, null);

        assertEquals(0, list.size());
    }

    @Test
    void create_success_shouldPersistAndReturnDetail() {
        UserAccountEntity user = buildUser(5L, "writer", "ACTIVE");
        when(userAccountMapper.selectById(5L)).thenReturn(user);
        when(taxonomyService.requireActiveCategoryForPost("NORMAL", 1L)).thenReturn(new CategoryEntity());
        when(taxonomyService.requireActiveTags(any())).thenReturn(List.of());
        doAnswer(invocation -> {
            PostEntity entity = invocation.getArgument(0);
            entity.setId(101L);
            return 1;
        }).when(postMapper).insert(any(PostEntity.class));

        PostDetailResponse expected = new PostDetailResponse();
        expected.setId(101L);
        expected.setPostType("NORMAL");
        expected.setAuthorUsername("writer");
        when(postAssembler.toDetail(any(PostEntity.class), any(), any(), anyBoolean(), anyBoolean()))
                .thenReturn(expected);

        CreatePostRequest request = new CreatePostRequest();
        request.setPostType("NORMAL");
        request.setTitle("Title");
        request.setCategoryId(1L);
        request.setContent("Body");

        PostDetailResponse response = postService.create(5L, request);

        assertEquals(101L, response.getId());
        assertEquals("NORMAL", response.getPostType());
        assertEquals("writer", response.getAuthorUsername());
        verify(taxonomyService).replacePostTags(101L, null);
    }

    @Test
    void listAdmin_shouldDelegateToAssembler() {
        PostEntity post = buildPost(1L, 5L, "NORMAL", "PUBLISHED", false);
        when(postMapper.selectList(any())).thenReturn(List.of(post));
        when(postAssembler.toSummaryList(List.of(post))).thenReturn(List.of(new PostSummaryResponse()));

        var result = postService.listAdmin(null, null, null, null, null);

        assertEquals(1, result.size());
        verify(postAssembler).toSummaryList(List.of(post));
    }

    private UserAccountEntity buildUser(Long id, String username, String status) {
        UserAccountEntity user = new UserAccountEntity();
        user.setId(id);
        user.setUsername(username);
        user.setStatus(status);
        return user;
    }

    private PostEntity buildPost(Long id, Long authorId, String type, String status, boolean deleted) {
        PostEntity post = new PostEntity();
        post.setId(id);
        post.setAuthorId(authorId);
        post.setPostType(type);
        post.setCategoryId(1L);
        post.setTitle("title");
        post.setStatus(status);
        post.setDeleted(deleted);
        return post;
    }
}
