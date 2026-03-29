CREATE TABLE IF NOT EXISTS post_like (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_like_post FOREIGN KEY (post_id) REFERENCES bbs_post (id),
    CONSTRAINT fk_post_like_user FOREIGN KEY (user_id) REFERENCES user_account (id),
    CONSTRAINT uq_post_like_post_user UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_like_post_id ON post_like (post_id);

CREATE INDEX IF NOT EXISTS idx_post_like_user_id_created_at ON post_like (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS comment_like (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comment_like_comment FOREIGN KEY (comment_id) REFERENCES post_comment (id),
    CONSTRAINT fk_comment_like_user FOREIGN KEY (user_id) REFERENCES user_account (id),
    CONSTRAINT uq_comment_like_comment_user UNIQUE (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_like_comment_id ON comment_like (comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_like_user_id_created_at ON comment_like (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_favorite (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_favorite_post FOREIGN KEY (post_id) REFERENCES bbs_post (id),
    CONSTRAINT fk_post_favorite_user FOREIGN KEY (user_id) REFERENCES user_account (id),
    CONSTRAINT uq_post_favorite_post_user UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_favorite_post_id ON post_favorite (post_id);

CREATE INDEX IF NOT EXISTS idx_post_favorite_user_id_created_at ON post_favorite (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_follow (
    id BIGSERIAL PRIMARY KEY,
    follower_id BIGINT NOT NULL,
    following_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_follow_follower FOREIGN KEY (follower_id) REFERENCES user_account (id),
    CONSTRAINT fk_user_follow_following FOREIGN KEY (following_id) REFERENCES user_account (id),
    CONSTRAINT uq_user_follow_relation UNIQUE (follower_id, following_id),
    CONSTRAINT chk_user_follow_not_self CHECK (follower_id <> following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follow_follower_id ON user_follow (follower_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_follow_following_id ON user_follow (following_id, created_at DESC);

CREATE TABLE IF NOT EXISTS post_report (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    reporter_id BIGINT NOT NULL,
    reason VARCHAR(64) NOT NULL,
    detail VARCHAR(1000),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    resolution_note VARCHAR(255),
    handled_by BIGINT,
    handled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_report_post FOREIGN KEY (post_id) REFERENCES bbs_post (id),
    CONSTRAINT fk_post_report_reporter FOREIGN KEY (reporter_id) REFERENCES user_account (id),
    CONSTRAINT fk_post_report_handled_by FOREIGN KEY (handled_by) REFERENCES user_account (id),
    CONSTRAINT chk_post_report_status CHECK (
        status IN ('PENDING', 'VALID', 'INVALID', 'PUNISHED')
    )
);

CREATE INDEX IF NOT EXISTS idx_post_report_status_created_at ON post_report (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_report_post_id ON post_report (post_id);

CREATE INDEX IF NOT EXISTS idx_post_report_reporter_id ON post_report (reporter_id);

CREATE TABLE IF NOT EXISTS comment_report (
    id BIGSERIAL PRIMARY KEY,
    comment_id BIGINT NOT NULL,
    reporter_id BIGINT NOT NULL,
    reason VARCHAR(64) NOT NULL,
    detail VARCHAR(1000),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    resolution_note VARCHAR(255),
    handled_by BIGINT,
    handled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comment_report_comment FOREIGN KEY (comment_id) REFERENCES post_comment (id),
    CONSTRAINT fk_comment_report_reporter FOREIGN KEY (reporter_id) REFERENCES user_account (id),
    CONSTRAINT fk_comment_report_handled_by FOREIGN KEY (handled_by) REFERENCES user_account (id),
    CONSTRAINT chk_comment_report_status CHECK (
        status IN ('PENDING', 'VALID', 'INVALID', 'PUNISHED')
    )
);

CREATE INDEX IF NOT EXISTS idx_comment_report_status_created_at ON comment_report (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comment_report_comment_id ON comment_report (comment_id);

CREATE INDEX IF NOT EXISTS idx_comment_report_reporter_id ON comment_report (reporter_id);