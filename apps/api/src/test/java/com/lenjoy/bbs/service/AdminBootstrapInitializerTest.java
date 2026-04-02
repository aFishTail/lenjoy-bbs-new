package com.lenjoy.bbs.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.lenjoy.bbs.config.AdminBootstrapProperties;
import com.lenjoy.bbs.domain.entity.RoleEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.domain.entity.UserRoleEntity;
import com.lenjoy.bbs.mapper.RoleMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import com.lenjoy.bbs.mapper.UserRoleMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

@ExtendWith(MockitoExtension.class)
class AdminBootstrapInitializerTest {

    @Mock
    private UserAccountMapper userAccountMapper;
    @Mock
    private UserRoleMapper userRoleMapper;
    @Mock
    private RoleMapper roleMapper;
    @Mock
    private PasswordEncoder passwordEncoder;

    private AdminBootstrapProperties properties;
    private AdminBootstrapInitializer initializer;

    @BeforeEach
    void setUp() {
        properties = new AdminBootstrapProperties();
        initializer = new AdminBootstrapInitializer(
                properties,
                userAccountMapper,
                userRoleMapper,
                roleMapper,
                passwordEncoder);
    }

    @Test
    void run_whenDisabled_shouldSkipBootstrap() {
        properties.setEnabled(false);

        assertDoesNotThrow(() -> initializer.run(new DefaultApplicationArguments(new String[0])));

        verify(userAccountMapper, never()).selectByUsername(any());
        verify(roleMapper, never()).selectOne(any());
    }

    @Test
    void run_whenUserMissing_shouldCreateAdminAndBindRole() throws Exception {
        properties.setEnabled(true);
        properties.setUsername("admin");
        properties.setPassword("Secret123");
        properties.setEmail("admin@example.com");

        RoleEntity adminRole = new RoleEntity();
        adminRole.setId(9L);
        adminRole.setRoleCode("ADMIN");
        when(roleMapper.selectOne(any())).thenReturn(adminRole);
        when(userAccountMapper.selectByUsername("admin")).thenReturn(null);
        when(passwordEncoder.encode("Secret123")).thenReturn("encoded");
        doAnswer(invocation -> {
            UserAccountEntity entity = invocation.getArgument(0);
            entity.setId(11L);
            return 1;
        }).when(userAccountMapper).insert(any(UserAccountEntity.class));
        when(userRoleMapper.selectCount(any())).thenReturn(0L);

        initializer.run(new DefaultApplicationArguments(new String[0]));

        ArgumentCaptor<UserAccountEntity> userCaptor = ArgumentCaptor.forClass(UserAccountEntity.class);
        verify(userAccountMapper).insert(userCaptor.capture());
        UserAccountEntity created = userCaptor.getValue();
        assertEquals("admin", created.getUsername());
        assertEquals("admin@example.com", created.getEmail());
        assertEquals("encoded", created.getPasswordHash());
        assertEquals("ACTIVE", created.getStatus());
        verify(userRoleMapper).insert(any(UserRoleEntity.class));
    }

    @Test
    void run_whenUserExistsWithoutAdminRole_shouldOnlyBindRole() throws Exception {
        properties.setEnabled(true);
        properties.setUsername("admin");
        properties.setPassword("Secret123");
        properties.setEmail("admin@example.com");

        RoleEntity adminRole = new RoleEntity();
        adminRole.setId(9L);
        adminRole.setRoleCode("ADMIN");
        UserAccountEntity existing = new UserAccountEntity();
        existing.setId(11L);
        existing.setUsername("admin");

        when(roleMapper.selectOne(any())).thenReturn(adminRole);
        when(userAccountMapper.selectByUsername("admin")).thenReturn(existing);
        when(userRoleMapper.selectCount(any())).thenReturn(0L);

        initializer.run(new DefaultApplicationArguments(new String[0]));

        verify(userAccountMapper, never()).insert(any(UserAccountEntity.class));
        verify(passwordEncoder, never()).encode(any());
        verify(userRoleMapper).insert(any(UserRoleEntity.class));
    }

    @Test
    void run_whenUserAlreadyHasAdminRole_shouldBeIdempotent() throws Exception {
        properties.setEnabled(true);
        properties.setUsername("admin");
        properties.setPassword("Secret123");
        properties.setEmail("admin@example.com");

        RoleEntity adminRole = new RoleEntity();
        adminRole.setId(9L);
        adminRole.setRoleCode("ADMIN");
        UserAccountEntity existing = new UserAccountEntity();
        existing.setId(11L);
        existing.setUsername("admin");

        when(roleMapper.selectOne(any())).thenReturn(adminRole);
        when(userAccountMapper.selectByUsername("admin")).thenReturn(existing);
        when(userRoleMapper.selectCount(any())).thenReturn(1L);

        initializer.run(new DefaultApplicationArguments(new String[0]));

        verify(userAccountMapper, never()).insert(any(UserAccountEntity.class));
        verify(userRoleMapper, never()).insert(any(UserRoleEntity.class));
        verify(passwordEncoder, never()).encode(any());
    }

    @Test
    void run_whenBootstrapEnabledWithoutRequiredConfig_shouldFailFast() {
        properties.setEnabled(true);
        properties.setUsername("admin");
        properties.setPassword("Secret123");

        IllegalStateException ex = assertThrows(
                IllegalStateException.class,
                () -> initializer.run(new DefaultApplicationArguments(new String[0])));

        assertEquals("ADMIN_BOOTSTRAP_EMAIL must be set when admin bootstrap is enabled.", ex.getMessage());
        verify(roleMapper, never()).selectOne(any());
    }
}
