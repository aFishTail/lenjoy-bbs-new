package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.entity.CategoryEntity;
import com.lenjoy.bbs.domain.entity.TagEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.CategoryMapper;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.PostTagMapper;
import com.lenjoy.bbs.mapper.TagAliasMapper;
import com.lenjoy.bbs.mapper.TagMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class TaxonomyServiceTest {

    @Mock
    private CategoryMapper categoryMapper;
    @Mock
    private TagMapper tagMapper;
    @Mock
    private PostTagMapper postTagMapper;
    @Mock
    private TagAliasMapper tagAliasMapper;
    @Mock
    private PostMapper postMapper;

    @InjectMocks
    private TaxonomyService taxonomyService;

    @Test
    void deleteCategory_whenUnused_shouldDelete() {
        CategoryEntity category = new CategoryEntity();
        category.setId(8L);
        when(categoryMapper.selectById(8L)).thenReturn(category);
        when(categoryMapper.selectCount(any())).thenReturn(0L);
        when(postMapper.selectCount(any())).thenReturn(0L);

        taxonomyService.deleteCategory(8L);

        verify(categoryMapper).deleteById(8L);
    }

    @Test
    void deleteCategory_whenHasChildren_shouldReject() {
        CategoryEntity category = new CategoryEntity();
        category.setId(8L);
        when(categoryMapper.selectById(8L)).thenReturn(category);
        when(categoryMapper.selectCount(any())).thenReturn(2L);

        ApiException ex = assertThrows(ApiException.class, () -> taxonomyService.deleteCategory(8L));

        assertEquals("CATEGORY_HAS_CHILDREN", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(postMapper, never()).selectCount(any());
        verify(categoryMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void deleteCategory_whenReferencedByPosts_shouldReject() {
        CategoryEntity category = new CategoryEntity();
        category.setId(8L);
        when(categoryMapper.selectById(8L)).thenReturn(category);
        when(categoryMapper.selectCount(any())).thenReturn(0L);
        when(postMapper.selectCount(any())).thenReturn(3L);

        ApiException ex = assertThrows(ApiException.class, () -> taxonomyService.deleteCategory(8L));

        assertEquals("CATEGORY_IN_USE", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(categoryMapper, never()).deleteById(any(Long.class));
    }

    @Test
    void deleteTag_whenUnused_shouldDelete() {
        TagEntity tag = new TagEntity();
        tag.setId(12L);
        when(tagMapper.selectById(12L)).thenReturn(tag);
        when(postTagMapper.selectCount(any())).thenReturn(0L);

        taxonomyService.deleteTag(12L);

        verify(tagMapper).deleteById(12L);
    }

    @Test
    void deleteTag_whenReferencedByPosts_shouldReject() {
        TagEntity tag = new TagEntity();
        tag.setId(12L);
        when(tagMapper.selectById(12L)).thenReturn(tag);
        when(postTagMapper.selectCount(any())).thenReturn(2L);

        ApiException ex = assertThrows(ApiException.class, () -> taxonomyService.deleteTag(12L));

        assertEquals("TAG_IN_USE", ex.getCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
        verify(tagMapper, never()).deleteById(any(Long.class));
    }
}
