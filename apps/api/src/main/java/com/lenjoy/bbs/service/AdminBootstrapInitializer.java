package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.config.AdminBootstrapProperties;
import com.lenjoy.bbs.domain.entity.RoleEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.entity.UserRoleEntity;
import com.lenjoy.bbs.mapper.RoleMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.UserRoleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class AdminBootstrapInitializer implements ApplicationRunner {

    private static final String ADMIN_ROLE_CODE = "ADMIN";

    private final AdminBootstrapProperties properties;
    private final UserAccountMapper userAccountMapper;
    private final UserRoleMapper userRoleMapper;
    private final RoleMapper roleMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.isEnabled()) {
            return;
        }

        String username = requireValue(properties.getUsername(), "ADMIN_BOOTSTRAP_USERNAME");
        String password = requireValue(properties.getPassword(), "ADMIN_BOOTSTRAP_PASSWORD");
        String email = requireValue(properties.getEmail(), "ADMIN_BOOTSTRAP_EMAIL");

        RoleEntity adminRole = roleMapper.selectOne(new LambdaQueryWrapper<RoleEntity>()
                .eq(RoleEntity::getRoleCode, ADMIN_ROLE_CODE)
                .last("LIMIT 1"));
        if (adminRole == null) {
            throw new IllegalStateException("ADMIN role is missing. Ensure Flyway migrations have completed.");
        }

        UserAccountEntity user = userAccountMapper.selectByUsername(username);
        if (user == null) {
            user = new UserAccountEntity();
            user.setUsername(username);
            user.setEmail(email);
            user.setPasswordHash(passwordEncoder.encode(password));
            user.setStatus("ACTIVE");
            userAccountMapper.insert(user);
            log.info("Bootstrapped admin account: {}", username);
        }

        ensureAdminRole(user.getId(), adminRole.getId(), username);
    }

    private void ensureAdminRole(Long userId, Long roleId, String username) {
        Long bindCount = userRoleMapper.selectCount(new LambdaQueryWrapper<UserRoleEntity>()
                .eq(UserRoleEntity::getUserId, userId)
                .eq(UserRoleEntity::getRoleId, roleId));
        if (bindCount != null && bindCount > 0) {
            return;
        }

        UserRoleEntity bind = new UserRoleEntity();
        bind.setUserId(userId);
        bind.setRoleId(roleId);
        userRoleMapper.insert(bind);
        log.info("Ensured ADMIN role for account: {}", username);
    }

    private String requireValue(String value, String envName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(envName + " must be set when admin bootstrap is enabled.");
        }
        return value.trim();
    }
}
