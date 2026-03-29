package com.lenjoy.bbs.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.lenjoy.bbs.domain.dto.MyProfileResponse;
import com.lenjoy.bbs.domain.dto.UpdateMyProfileRequest;
import com.lenjoy.bbs.domain.entity.PostEntity;
import com.lenjoy.bbs.domain.entity.UserAccountEntity;
import com.lenjoy.bbs.exception.ApiException;
import com.lenjoy.bbs.mapper.PostMapper;
import com.lenjoy.bbs.mapper.UserAccountMapper;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserProfileService {

    private final UserAccountMapper userAccountMapper;
    private final PostMapper postMapper;
    private final InteractionService interactionService;

    public MyProfileResponse getMyProfile(Long userId) {
        UserAccountEntity user = requireUser(userId);

        long postCount = postMapper.selectCount(new LambdaQueryWrapper<PostEntity>()
                .eq(PostEntity::getAuthorId, userId)
                .eq(PostEntity::getDeleted, false));

        MyProfileResponse response = new MyProfileResponse();
        response.setId(user.getId());
        response.setUsername(user.getUsername());
        response.setEmail(user.getEmail());
        response.setPhone(user.getPhone());
        response.setAvatarUrl(user.getAvatarUrl());
        response.setBio(user.getBio());
        response.setPostCount(postCount);
        response.setFollowingCount(interactionService.countFollowing(userId));
        response.setFollowerCount(interactionService.countFollowers(userId));
        return response;
    }

    @Transactional
    public MyProfileResponse updateMyProfile(Long userId, UpdateMyProfileRequest request) {
        UserAccountEntity user = requireUser(userId);
        String normalizedUsername = request.getUsername().trim();

        boolean changedUsername = !normalizedUsername.equals(user.getUsername());
        if (changedUsername && existsUsername(userId, normalizedUsername)) {
            throw new ApiException("USERNAME_EXISTS", "昵称已存在", HttpStatus.CONFLICT);
        }

        user.setUsername(normalizedUsername);
        user.setAvatarUrl(blankToNull(request.getAvatarUrl()));
        user.setBio(blankToNull(request.getBio()));
        user.setUpdatedAt(LocalDateTime.now());
        userAccountMapper.updateById(user);

        return getMyProfile(userId);
    }

    private UserAccountEntity requireUser(Long userId) {
        UserAccountEntity user = userAccountMapper.selectById(userId);
        if (user == null) {
            throw new ApiException("USER_NOT_FOUND", "用户不存在", HttpStatus.NOT_FOUND);
        }
        return user;
    }

    private boolean existsUsername(Long userId, String username) {
        return userAccountMapper.selectCount(new LambdaQueryWrapper<UserAccountEntity>()
                .eq(UserAccountEntity::getUsername, username)
                .ne(UserAccountEntity::getId, userId)) > 0;
    }

    private String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
