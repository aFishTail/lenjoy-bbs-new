package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.entity.PostEntity;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PostAssemblerTest {

    @Mock
    private ResourceTradeService resourceTradeService;

    @Mock
    private InteractionService interactionService;

    @Mock
    private TaxonomyService taxonomyService;

    @InjectMocks
    private PostAssembler postAssembler;

    @Test
    void toDetail_whenPostNotOffline_shouldNotExposeOfflineFields() {
        PostEntity entity = new PostEntity();
        entity.setId(1L);
        entity.setAuthorId(2L);
        entity.setPostType("NORMAL");
        entity.setCategoryId(10L);
        entity.setTitle("title");
        entity.setStatus("PUBLISHED");
        entity.setContent("content");
        entity.setOfflineReason("historical reason");
        entity.setOfflinedAt(LocalDateTime.now().minusDays(1));
        entity.setCreatedAt(LocalDateTime.now().minusDays(2));
        entity.setUpdatedAt(LocalDateTime.now());

        when(taxonomyService.findCategoryMap(List.of(10L))).thenReturn(Map.of());
        when(taxonomyService.findTagsByPostIds(List.of(1L))).thenReturn(Map.of());
        when(interactionService.countPostLikes(1L)).thenReturn(0L);
        when(interactionService.countPostFavorites(1L)).thenReturn(0L);
        when(interactionService.countPostComments(1L)).thenReturn(0L);
        when(interactionService.hasPostLiked(1L, null)).thenReturn(false);
        when(interactionService.hasPostFavorited(1L, null)).thenReturn(false);

        var response = postAssembler.toDetail(entity, "author", null, false, false);

        assertEquals("PUBLISHED", response.getStatus());
        assertNull(response.getOfflineReason());
        assertNull(response.getOfflinedAt());
    }
}
