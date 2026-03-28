package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.AdminUserSummaryResponse;
import com.lenjoy.bbs.domain.dto.UpdateUserStatusRequest;
import com.lenjoy.bbs.domain.entity.AdminUserStatusLogEntity;
import com.lenjoy.bbs.domain.entity.RoleEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.entity.UserRoleEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.AdminUserStatusLogMapper;
import com.lenjoy.bbs.mapper.RoleMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.UserRoleMapper;
import java.time.LocalDateTime;
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
public class AdminUserService {

    private static final Set<String> ALLOWED_STATUS = Set.of("ACTIVE", "MUTED", "BANNED");

    private final UserAccountMapper userAccountMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final AdminUserStatusLogMapper adminUserStatusLogMapper;

    public List<AdminUserSummaryResponse> listUsers(String status, String keyword) {
        LambdaQueryWrapper<UserAccountEntity> query = new LambdaQueryWrapper<UserAccountEntity>()
                .orderByDesc(UserAccountEntity::getCreatedAt);

        if (status != null && !status.isBlank()) {
            String normalizedStatus = normalizeStatus(status);
            query.eq(UserAccountEntity::getStatus, normalizedStatus);
        }

        if (keyword != null && !keyword.isBlank()) {
            String trimmed = keyword.trim();
            query.and(wrapper -> wrapper
                    .like(UserAccountEntity::getUsername, trimmed)
                    .or()
                    .like(UserAccountEntity::getEmail, trimmed)
                    .or()
                    .like(UserAccountEntity::getPhone, trimmed));
        }

        List<UserAccountEntity> users = userAccountMapper.selectList(query);
        if (users.isEmpty()) {
            return List.of();
        }

        Set<Long> userIds = users.stream().map(UserAccountEntity::getId).collect(Collectors.toSet());
        List<UserRoleEntity> roleBinds = userRoleMapper.selectList(new LambdaQueryWrapper<UserRoleEntity>()
                .in(UserRoleEntity::getUserId, userIds));

        Map<Long, List<Long>> roleIdsByUser = roleBinds.stream()
                .collect(Collectors.groupingBy(
                        UserRoleEntity::getUserId,
                        Collectors.mapping(UserRoleEntity::getRoleId, Collectors.toList())));

        Set<Long> roleIds = roleBinds.stream().map(UserRoleEntity::getRoleId).collect(Collectors.toSet());
        Map<Long, String> roleCodeById = roleIds.isEmpty()
                ? Map.of()
                : roleMapper.selectList(new LambdaQueryWrapper<RoleEntity>()
                        .in(RoleEntity::getId, roleIds)).stream()
                        .collect(Collectors.toMap(RoleEntity::getId, RoleEntity::getRoleCode));

        return users.stream().map(user -> {
            AdminUserSummaryResponse resp = new AdminUserSummaryResponse();
            resp.setId(user.getId());
            resp.setUsername(user.getUsername());
            resp.setEmail(user.getEmail());
            resp.setPhone(user.getPhone());
            resp.setStatus(user.getStatus());
            resp.setCreatedAt(user.getCreatedAt());
            resp.setUpdatedAt(user.getUpdatedAt());

            List<String> roleCodes = roleIdsByUser.getOrDefault(user.getId(), List.of()).stream()
                    .map(roleCodeById::get)
                    .filter(code -> code != null && !code.isBlank())
                    .toList();
            resp.setRoles(roleCodes.isEmpty() ? List.of("USER") : roleCodes);
            return resp;
        }).toList();
    }

    @Transactional
    public void updateUserStatus(Long targetUserId, Long operatorUserId, UpdateUserStatusRequest request) {
        UserAccountEntity targetUser = requireUser(targetUserId);

        if (targetUserId.equals(operatorUserId)) {
            throw new ApiException("INVALID_OPERATION", "不可修改自己的账号状态", HttpStatus.BAD_REQUEST);
        }

        if (isAdminUser(targetUserId)) {
            throw new ApiException("INVALID_OPERATION", "不可修改管理员账号状态", HttpStatus.BAD_REQUEST);
        }

        String newStatus = normalizeStatus(request.getStatus());
        String oldStatus = targetUser.getStatus();
        String reason = request.getReason().trim();

        if (oldStatus.equalsIgnoreCase(newStatus)) {
            throw new ApiException("STATUS_UNCHANGED", "用户状态未变化", HttpStatus.BAD_REQUEST);
        }

        targetUser.setStatus(newStatus);
        targetUser.setUpdatedAt(LocalDateTime.now());
        userAccountMapper.updateById(targetUser);

        AdminUserStatusLogEntity log = new AdminUserStatusLogEntity();
        log.setTargetUserId(targetUserId);
        log.setOldStatus(oldStatus.toUpperCase());
        log.setNewStatus(newStatus);
        log.setReason(reason);
        log.setOperatedBy(operatorUserId);
        log.setOperatedAt(LocalDateTime.now());
        adminUserStatusLogMapper.insert(log);
    }

    private UserAccountEntity requireUser(Long userId) {
        UserAccountEntity user = userAccountMapper.selectById(userId);
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private String normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new ApiException("STATUS_INVALID", "用户状态不合法", HttpStatus.BAD_REQUEST);
        }
        String normalized = status.trim().toUpperCase();
        if (!ALLOWED_STATUS.contains(normalized)) {
            throw new ApiException("STATUS_INVALID", "用户状态不合法", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private boolean isAdminUser(Long userId) {
        List<UserRoleEntity> binds = userRoleMapper.selectList(new LambdaQueryWrapper<UserRoleEntity>()
                .eq(UserRoleEntity::getUserId, userId));
        if (binds.isEmpty()) {
            return false;
        }
        Set<Long> roleIds = binds.stream().map(UserRoleEntity::getRoleId).collect(Collectors.toSet());
        if (roleIds.isEmpty()) {
            return false;
        }
        return roleMapper.selectList(new LambdaQueryWrapper<RoleEntity>()
                .in(RoleEntity::getId, roleIds)).stream()
                .anyMatch(role -> "ADMIN".equalsIgnoreCase(role.getRoleCode()));
    }
}
