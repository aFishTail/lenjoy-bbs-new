package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.domain.entity.PostCommentEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostCommentMapper;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

@ExtendWith(MockitoExtension.class)
class BountyServiceTest {

    @Mock
    private PostMapper postMapper;

    @Mock
    private PostCommentMapper postCommentMapper;

    @Mock
    private UserAccountMapper userAccountMapper;

    @Mock
    private WalletService walletService;

    @Mock
    private SiteMessageService siteMessageService;

    @InjectMocks
    private BountyService bountyService;

    @Test
    void acceptAnswer_whenValid_shouldSettleAndSendMessages() {
        PostEntity post = buildBountyPost(100L, 1L, 30);
        PostCommentEntity comment = buildTopLevelComment(200L, 100L, 2L);
        UserAccountEntity answerer = new UserAccountEntity();
        answerer.setId(2L);
        answerer.setUsername("answerer");

        when(postMapper.selectById(100L)).thenReturn(post);
        when(postCommentMapper.selectById(200L)).thenReturn(comment);
        when(userAccountMapper.selectById(2L)).thenReturn(answerer);

        PostCommentEntity result = bountyService.acceptAnswer(100L, 200L, 1L);

        assertEquals(200L, result.getId());
        assertEquals(Boolean.TRUE, result.getAccepted());
        assertEquals(BountyService.BOUNTY_STATUS_RESOLVED, post.getBountyStatus());
        assertEquals(200L, post.getAcceptedCommentId());

        verify(walletService).unfreezeCoins(
                eq(1L),
                eq(30),
                eq("BOUNTY_UNFREEZE_FOR_AWARD"),
                eq("bounty:award:unfreeze:100"),
                eq("悬赏《测试悬赏》结算赏金"),
                eq(null));
        verify(walletService).adjustAvailableCoins(
                eq(1L),
                eq("EXPENSE"),
                eq(30),
                eq("BOUNTY_AWARD_OUT"),
                eq("bounty:award:expense:100"),
                eq("悬赏《测试悬赏》发放赏金"),
                eq(null));
        verify(walletService).adjustAvailableCoins(
                eq(2L),
                eq("INCOME"),
                eq(30),
                eq("BOUNTY_AWARD_IN"),
                eq("bounty:award:income:100"),
                eq("悬赏《测试悬赏》被采纳发奖"),
                eq(null));
        verify(postCommentMapper).updateById(comment);
        verify(postMapper).updateById(post);
        verify(siteMessageService, times(2)).createMessage(
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyString(),
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.anyLong(),
                org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull());
    }

    @Test
    void acceptAnswer_whenNotAuthor_shouldThrowForbidden() {
        PostEntity post = buildBountyPost(100L, 1L, 30);
        when(postMapper.selectById(100L)).thenReturn(post);

        ApiException ex = assertThrows(ApiException.class, () -> bountyService.acceptAnswer(100L, 200L, 3L));

        assertEquals("FORBIDDEN", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getHttpStatus());
    }

    @Test
    void ensureActiveOrExpire_whenOverdue_shouldRefundAndClosePost() {
        PostEntity post = buildBountyPost(88L, 9L, 45);
        post.setBountyExpireAt(LocalDateTime.now().minusMinutes(1));

        bountyService.ensureActiveOrExpire(post, 77L);

        assertEquals(BountyService.BOUNTY_STATUS_EXPIRED, post.getBountyStatus());
        assertEquals("CLOSED", post.getStatus());
        verify(walletService).unfreezeCoins(
                eq(9L),
                eq(45),
                eq("BOUNTY_REFUND_TIMEOUT"),
                eq("bounty:refund:timeout:88"),
                eq("悬赏超时自动退回"),
                eq(77L));
        verify(postMapper).updateById(post);
        verify(siteMessageService).createMessage(
                eq(9L),
                eq(SiteMessageService.MESSAGE_TYPE_BOUNTY_REFUNDED_AUTHOR),
                eq("悬赏已退回"),
                org.mockito.ArgumentMatchers.contains("45 金币已退回钱包"),
                eq(88L),
                eq(88L),
                eq(null),
                eq(null));
    }

    private PostEntity buildBountyPost(Long id, Long authorId, int amount) {
        PostEntity post = new PostEntity();
        post.setId(id);
        post.setAuthorId(authorId);
        post.setPostType(BountyService.TYPE_BOUNTY);
        post.setTitle("测试悬赏");
        post.setStatus("PUBLISHED");
        post.setDeleted(false);
        post.setBountyAmount(amount);
        post.setBountyStatus(BountyService.BOUNTY_STATUS_ACTIVE);
        post.setBountyExpireAt(LocalDateTime.now().plusHours(1));
        return post;
    }

    private PostCommentEntity buildTopLevelComment(Long id, Long postId, Long authorId) {
        PostCommentEntity comment = new PostCommentEntity();
        comment.setId(id);
        comment.setPostId(postId);
        comment.setAuthorId(authorId);
        comment.setParentId(null);
        comment.setDeleted(false);
        comment.setAccepted(false);
        return comment;
    }
}
