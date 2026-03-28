package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.AuthResponse;
import com.lenjoy.bbs.domain.dto.LoginRequest;
import com.lenjoy.bbs.domain.dto.RegisterRequest;
import com.lenjoy.bbs.domain.entity.RoleEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.entity.UserRoleEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.RoleMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.UserRoleMapper;
import com.lenjoy.bbs.security.JwtTokenProvider;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Set<String> RESERVED_USERNAMES = Set.of(
            "admin", "root", "system", "support", "moderator");

    private final UserAccountMapper userAccountMapper;
    private final RoleMapper roleMapper;
    private final UserRoleMapper userRoleMapper;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider jwtTokenProvider;
    private final CaptchaService captchaService;

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        captchaService.verifyAndConsume(request.getCaptchaId(), request.getCaptchaCode());
        validateRegistrationInput(request);

        String normalizedUsername = request.getUsername().trim();
        if (existsUsername(normalizedUsername)) {
            throw new ApiException("USERNAME_EXISTS", "用户名已存在", HttpStatus.CONFLICT);
        }
        if (request.getEmail() != null && !request.getEmail().isBlank() && existsEmail(request.getEmail())) {
            throw new ApiException("EMAIL_EXISTS", "邮箱已存在", HttpStatus.CONFLICT);
        }
        if (request.getPhone() != null && !request.getPhone().isBlank() && existsPhone(request.getPhone())) {
            throw new ApiException("PHONE_EXISTS", "手机号已存在", HttpStatus.CONFLICT);
        }

        UserAccountEntity user = new UserAccountEntity();
        user.setUsername(normalizedUsername);
        user.setEmail(blankToNull(request.getEmail()));
        user.setPhone(blankToNull(request.getPhone()));
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setStatus("ACTIVE");
        userAccountMapper.insert(user);

        RoleEntity userRole = roleMapper.selectOne(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getRoleCode, "USER"));
        if (userRole != null) {
            UserRoleEntity bind = new UserRoleEntity();
            bind.setUserId(user.getId());
            bind.setRoleId(userRole.getId());
            userRoleMapper.insert(bind);
        }
        return toAuthResponse(user, List.of("USER"));
    }

    public AuthResponse login(LoginRequest request) {
        captchaService.verifyAndConsume(request.getCaptchaId(), request.getCaptchaCode());

        UserAccountEntity user = findByAccount(request.getAccount());
        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new ApiException("LOGIN_FAILED", "账号或密码错误", HttpStatus.UNAUTHORIZED);
        }
        if ("BANNED".equalsIgnoreCase(user.getStatus())) {
            throw new ApiException("ACCOUNT_DISABLED", "账号已被封禁", HttpStatus.FORBIDDEN);
        }
        List<String> roles = loadRoleCodes(user.getId());
        if (roles.isEmpty()) {
            roles = List.of("USER");
        }
        return toAuthResponse(user, roles);
    }

    private void validateRegistrationInput(RegisterRequest request) {
        String username = request.getUsername().trim().toLowerCase(Locale.ROOT);
        if (RESERVED_USERNAMES.contains(username)) {
            throw new ApiException("USERNAME_RESERVED", "用户名为系统保留词", HttpStatus.BAD_REQUEST);
        }
        boolean hasEmail = request.getEmail() != null && !request.getEmail().isBlank();
        boolean hasPhone = request.getPhone() != null && !request.getPhone().isBlank();
        if (!hasEmail && !hasPhone) {
            throw new ApiException("CONTACT_REQUIRED", "邮箱或手机号至少填写一项", HttpStatus.BAD_REQUEST);
        }
    }

    private UserAccountEntity findByAccount(String account) {
        String normalized = account == null ? "" : account.trim();
        if (normalized.contains("@")) {
            return userAccountMapper.selectOne(new LambdaQueryWrapper<UserAccountEntity>()
                    .eq(UserAccountEntity::getEmail, normalized));
        }
        UserAccountEntity byPhone = userAccountMapper.selectOne(new LambdaQueryWrapper<UserAccountEntity>()
                .eq(UserAccountEntity::getPhone, normalized));
        if (byPhone != null) {
            return byPhone;
        }
        return userAccountMapper.selectOne(new LambdaQueryWrapper<UserAccountEntity>()
                .eq(UserAccountEntity::getUsername, normalized));
    }

    private boolean existsUsername(String username) {
        return userAccountMapper.selectCount(new LambdaQueryWrapper<UserAccountEntity>()
                .eq(UserAccountEntity::getUsername, username)) > 0;
    }

    private boolean existsEmail(String email) {
        return userAccountMapper.selectCount(new LambdaQueryWrapper<UserAccountEntity>()
                .eq(UserAccountEntity::getEmail, email.trim())) > 0;
    }

    private boolean existsPhone(String phone) {
        return userAccountMapper.selectCount(new LambdaQueryWrapper<UserAccountEntity>()
                .eq(UserAccountEntity::getPhone, phone.trim())) > 0;
    }

    private List<String> loadRoleCodes(Long userId) {
        List<UserRoleEntity> binds = userRoleMapper.selectList(new LambdaQueryWrapper<UserRoleEntity>()
                .eq(UserRoleEntity::getUserId, userId));
        if (binds.isEmpty()) {
            return List.of();
        }
        List<Long> roleIds = binds.stream().map(UserRoleEntity::getRoleId).toList();
        List<RoleEntity> roles = roleMapper.selectList(new LambdaQueryWrapper<RoleEntity>()
                .in(RoleEntity::getId, roleIds));
        return roles.stream().map(RoleEntity::getRoleCode).toList();
    }

    private AuthResponse toAuthResponse(UserAccountEntity user, List<String> roles) {
        String token = jwtTokenProvider.createAccessToken(user.getId(), user.getUsername(), roles);
        AuthResponse resp = new AuthResponse();
        resp.setToken(token);
        resp.setTokenType("Bearer");
        resp.setExpiresIn(jwtTokenProvider.getAccessTokenTtlSeconds());
        AuthResponse.UserSummary summary = new AuthResponse.UserSummary();
        summary.setId(user.getId());
        summary.setUsername(user.getUsername());
        summary.setEmail(user.getEmail());
        summary.setPhone(user.getPhone());
        summary.setAvatarUrl(user.getAvatarUrl());
        summary.setBio(user.getBio());
        resp.setUser(summary);
        return resp;
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}