package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.CreateReportRequest;
import com.lenjoy.bbs.domain.dto.ReportItemResponse;
import com.lenjoy.bbs.domain.dto.ReviewReportRequest;
import com.lenjoy.bbs.domain.dto.UpdateUserStatusRequest;
import com.lenjoy.bbs.domain.entity.CommentReportEntity;
import com.lenjoy.bbs.domain.entity.PostCommentEntity;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.PostReportEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.CommentReportMapper;
import com.lenjoy.bbs.mapper.PostCommentMapper;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.PostReportMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final PostReportMapper postReportMapper;
    private final CommentReportMapper commentReportMapper;
    private final PostMapper postMapper;
    private final PostCommentMapper postCommentMapper;
    private final UserAccountMapper userAccountMapper;
    private final PostService postService;
    private final CommentService commentService;
    private final AdminUserService adminUserService;

    @Transactional
    public ReportItemResponse createPostReport(Long postId, Long reporterId, CreateReportRequest request) {
        PostEntity post = requirePost(postId);
        requireUser(reporterId);
        PostReportEntity existing = postReportMapper.selectPendingByPostIdAndReporterId(postId, reporterId);
        if (existing != null) {
            throw new ApiException("REPORT_EXISTS", "你已举报该帖子，等待处理", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime now = LocalDateTime.now();
        PostReportEntity entity = new PostReportEntity();
        entity.setPostId(postId);
        entity.setReporterId(reporterId);
        entity.setReason(request.getReason().trim());
        entity.setDetail(blankToNull(request.getDetail()));
        entity.setStatus("PENDING");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        postReportMapper.insert(entity);

        return toPostReportResponse(entity, post, requireUser(reporterId), null);
    }

    @Transactional
    public ReportItemResponse createCommentReport(Long commentId, Long reporterId, CreateReportRequest request) {
        PostCommentEntity comment = requireComment(commentId);
        requireUser(reporterId);
        CommentReportEntity existing = commentReportMapper.selectPendingByCommentIdAndReporterId(commentId, reporterId);
        if (existing != null) {
            throw new ApiException("REPORT_EXISTS", "你已举报该评论，等待处理", HttpStatus.BAD_REQUEST);
        }

        LocalDateTime now = LocalDateTime.now();
        CommentReportEntity entity = new CommentReportEntity();
        entity.setCommentId(commentId);
        entity.setReporterId(reporterId);
        entity.setReason(request.getReason().trim());
        entity.setDetail(blankToNull(request.getDetail()));
        entity.setStatus("PENDING");
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        commentReportMapper.insert(entity);

        return toCommentReportResponse(entity, comment, requireUser(reporterId), null);
    }

    public List<ReportItemResponse> listAdminReports(String status, String targetType, String keyword) {
        List<ReportItemResponse> merged = new ArrayList<>();
        String normalizedStatus = normalizeStatus(status, false);
        String normalizedTargetType = normalizeTargetType(targetType);

        if (normalizedTargetType == null || "POST".equals(normalizedTargetType)) {
            List<PostReportEntity> postReports = postReportMapper.selectList(new LambdaQueryWrapper<PostReportEntity>()
                    .eq(normalizedStatus != null, PostReportEntity::getStatus, normalizedStatus)
                    .orderByDesc(PostReportEntity::getCreatedAt));
            if (!postReports.isEmpty()) {
                Map<Long, PostEntity> postMap = postMapper.selectList(new LambdaQueryWrapper<PostEntity>()
                        .in(PostEntity::getId,
                                postReports.stream().map(PostReportEntity::getPostId).collect(Collectors.toSet())))
                        .stream()
                        .collect(Collectors.toMap(PostEntity::getId, item -> item));
                Map<Long, UserAccountEntity> userMap = loadUsers(postReports.stream()
                        .flatMap(item -> java.util.stream.Stream.of(item.getReporterId(), item.getHandledBy()))
                        .filter(item -> item != null)
                        .collect(Collectors.toSet()));
                merged.addAll(postReports.stream().map(item -> toPostReportResponse(
                        item,
                        postMap.get(item.getPostId()),
                        userMap.get(item.getReporterId()),
                        userMap.get(item.getHandledBy()))).toList());
            }
        }

        if (normalizedTargetType == null || "COMMENT".equals(normalizedTargetType)) {
            List<CommentReportEntity> commentReports = commentReportMapper
                    .selectList(new LambdaQueryWrapper<CommentReportEntity>()
                            .eq(normalizedStatus != null, CommentReportEntity::getStatus, normalizedStatus)
                            .orderByDesc(CommentReportEntity::getCreatedAt));
            if (!commentReports.isEmpty()) {
                Map<Long, PostCommentEntity> commentMap = postCommentMapper
                        .selectList(new LambdaQueryWrapper<PostCommentEntity>()
                                .in(PostCommentEntity::getId,
                                        commentReports.stream().map(CommentReportEntity::getCommentId)
                                                .collect(Collectors.toSet())))
                        .stream()
                        .collect(Collectors.toMap(PostCommentEntity::getId, item -> item));
                Map<Long, UserAccountEntity> userMap = loadUsers(commentReports.stream()
                        .flatMap(item -> java.util.stream.Stream.of(item.getReporterId(), item.getHandledBy()))
                        .filter(item -> item != null)
                        .collect(Collectors.toSet()));
                merged.addAll(commentReports.stream().map(item -> toCommentReportResponse(
                        item,
                        commentMap.get(item.getCommentId()),
                        userMap.get(item.getReporterId()),
                        userMap.get(item.getHandledBy()))).toList());
            }
        }

        List<ReportItemResponse> sorted = merged.stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .toList();
        if (keyword == null || keyword.isBlank()) {
            return sorted;
        }
        String key = keyword.trim();
        return sorted.stream().filter(item -> contains(item.getReason(), key)
                || contains(item.getDetail(), key)
                || contains(item.getReporterUsername(), key)
                || contains(item.getTargetTitle(), key)).toList();
    }

    @Transactional
    public ReportItemResponse reviewPostReport(Long reportId, Long adminId, ReviewReportRequest request) {
        PostReportEntity report = requirePostReport(reportId);
        PostEntity post = requirePost(report.getPostId());
        UserAccountEntity reporter = requireUser(report.getReporterId());
        UserAccountEntity admin = requireUser(adminId);
        applyReviewStatus(report, adminId, request);
        postReportMapper.updateById(report);

        applyActionIfNeeded(request, post, null, adminId);
        return toPostReportResponse(report, post, reporter, admin);
    }

    @Transactional
    public ReportItemResponse reviewCommentReport(Long reportId, Long adminId, ReviewReportRequest request) {
        CommentReportEntity report = requireCommentReport(reportId);
        PostCommentEntity comment = requireComment(report.getCommentId());
        UserAccountEntity reporter = requireUser(report.getReporterId());
        UserAccountEntity admin = requireUser(adminId);
        applyReviewStatus(report, adminId, request);
        commentReportMapper.updateById(report);

        applyActionIfNeeded(request, null, comment, adminId);
        return toCommentReportResponse(report, comment, reporter, admin);
    }

    private void applyReviewStatus(PostReportEntity report, Long adminId, ReviewReportRequest request) {
        String status = normalizeStatus(request.getStatus(), true);
        LocalDateTime now = LocalDateTime.now();
        report.setStatus(status);
        report.setResolutionNote(blankToNull(request.getResolutionNote()));
        report.setHandledBy(adminId);
        report.setHandledAt(now);
        report.setUpdatedAt(now);
    }

    private void applyReviewStatus(CommentReportEntity report, Long adminId, ReviewReportRequest request) {
        String status = normalizeStatus(request.getStatus(), true);
        LocalDateTime now = LocalDateTime.now();
        report.setStatus(status);
        report.setResolutionNote(blankToNull(request.getResolutionNote()));
        report.setHandledBy(adminId);
        report.setHandledAt(now);
        report.setUpdatedAt(now);
    }

    private void applyActionIfNeeded(ReviewReportRequest request, PostEntity post, PostCommentEntity comment,
            Long adminId) {
        if (request.getAction() == null || request.getAction().isBlank()) {
            return;
        }
        String action = request.getAction().trim().toUpperCase();
        String reason = request.getResolutionNote() == null || request.getResolutionNote().isBlank()
                ? "举报处理联动"
                : request.getResolutionNote().trim();

        if ("OFFLINE_POST".equals(action) && post != null) {
            com.lenjoy.bbs.domain.dto.OfflinePostRequest req = new com.lenjoy.bbs.domain.dto.OfflinePostRequest();
            req.setReason(reason);
            postService.offline(post.getId(), adminId, req);
            return;
        }
        if ("DELETE_COMMENT".equals(action) && comment != null) {
            commentService.deleteByAdmin(comment.getId(), adminId, reason);
            return;
        }
        if ("MUTE_USER".equals(action) || "BAN_USER".equals(action)) {
            if (request.getTargetUserId() == null) {
                throw new ApiException("TARGET_USER_REQUIRED", "缺少处罚用户", HttpStatus.BAD_REQUEST);
            }
            UpdateUserStatusRequest statusRequest = new UpdateUserStatusRequest();
            statusRequest.setStatus("MUTE_USER".equals(action) ? "MUTED" : "BANNED");
            statusRequest.setReason(reason);
            adminUserService.updateUserStatus(request.getTargetUserId(), adminId, statusRequest);
        }
    }

    private ReportItemResponse toPostReportResponse(PostReportEntity report,
            PostEntity post,
            UserAccountEntity reporter,
            UserAccountEntity admin) {
        ReportItemResponse response = new ReportItemResponse();
        response.setTargetType("POST");
        response.setReportId(report.getId());
        response.setTargetId(report.getPostId());
        response.setReporterId(report.getReporterId());
        response.setReporterUsername(reporter == null ? null : reporter.getUsername());
        response.setReason(report.getReason());
        response.setDetail(report.getDetail());
        response.setStatus(report.getStatus());
        response.setResolutionNote(report.getResolutionNote());
        response.setHandledBy(report.getHandledBy());
        response.setHandledByUsername(admin == null ? null : admin.getUsername());
        response.setCreatedAt(report.getCreatedAt());
        response.setHandledAt(report.getHandledAt());
        response.setTargetTitle(post == null ? null : post.getTitle());
        return response;
    }

    private ReportItemResponse toCommentReportResponse(CommentReportEntity report,
            PostCommentEntity comment,
            UserAccountEntity reporter,
            UserAccountEntity admin) {
        ReportItemResponse response = new ReportItemResponse();
        response.setTargetType("COMMENT");
        response.setReportId(report.getId());
        response.setTargetId(report.getCommentId());
        response.setReporterId(report.getReporterId());
        response.setReporterUsername(reporter == null ? null : reporter.getUsername());
        response.setReason(report.getReason());
        response.setDetail(report.getDetail());
        response.setStatus(report.getStatus());
        response.setResolutionNote(report.getResolutionNote());
        response.setHandledBy(report.getHandledBy());
        response.setHandledByUsername(admin == null ? null : admin.getUsername());
        response.setCreatedAt(report.getCreatedAt());
        response.setHandledAt(report.getHandledAt());
        response.setTargetTitle(comment == null ? null : comment.getContent());
        return response;
    }

    private String normalizeStatus(String status, boolean required) {
        if (status == null || status.isBlank()) {
            if (required) {
                throw new ApiException("REPORT_STATUS_INVALID", "举报状态不合法", HttpStatus.BAD_REQUEST);
            }
            return null;
        }
        String normalized = status.trim().toUpperCase();
        if (!Set.of("PENDING", "VALID", "INVALID", "PUNISHED").contains(normalized)) {
            throw new ApiException("REPORT_STATUS_INVALID", "举报状态不合法", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeTargetType(String targetType) {
        if (targetType == null || targetType.isBlank()) {
            return null;
        }
        String normalized = targetType.trim().toUpperCase();
        if (!Set.of("POST", "COMMENT").contains(normalized)) {
            throw new ApiException("TARGET_TYPE_INVALID", "举报目标类型不合法", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private PostEntity requirePost(Long postId) {
        PostEntity post = postMapper.selectById(postId);
        if (post == null) {
            throw new ApiException("POST_NOT_FOUND", "帖子不存在", HttpStatus.NOT_FOUND);
        }
        return post;
    }

    private PostCommentEntity requireComment(Long commentId) {
        PostCommentEntity comment = postCommentMapper.selectById(commentId);
        if (comment == null) {
            throw new ApiException("COMMENT_NOT_FOUND", "评论不存在", HttpStatus.NOT_FOUND);
        }
        return comment;
    }

    private UserAccountEntity requireUser(Long userId) {
        UserAccountEntity user = userAccountMapper.selectById(userId);
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private PostReportEntity requirePostReport(Long reportId) {
        PostReportEntity report = postReportMapper.selectById(reportId);
        if (report == null) {
            throw new ApiException("REPORT_NOT_FOUND", "举报记录不存在", HttpStatus.NOT_FOUND);
        }
        return report;
    }

    private CommentReportEntity requireCommentReport(Long reportId) {
        CommentReportEntity report = commentReportMapper.selectById(reportId);
        if (report == null) {
            throw new ApiException("REPORT_NOT_FOUND", "举报记录不存在", HttpStatus.NOT_FOUND);
        }
        return report;
    }

    private Map<Long, UserAccountEntity> loadUsers(Set<Long> userIds) {
        if (userIds.isEmpty()) {
            return Map.of();
        }
        return userAccountMapper.selectList(new LambdaQueryWrapper<UserAccountEntity>()
                .in(UserAccountEntity::getId, userIds)).stream()
                .collect(Collectors.toMap(UserAccountEntity::getId, item -> item));
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean contains(String text, String key) {
        return text != null && text.toLowerCase().contains(key.toLowerCase());
    }
}
