ALTER TABLE
    bbs_post
ADD
    COLUMN IF NOT EXISTS bounty_status VARCHAR(32),
ADD
    COLUMN IF NOT EXISTS bounty_expire_at TIMESTAMP,
ADD
    COLUMN IF NOT EXISTS bounty_settled_at TIMESTAMP,
ADD
    COLUMN IF NOT EXISTS accepted_comment_id BIGINT;

UPDATE
    bbs_post
SET
    bounty_status = 'ACTIVE'
WHERE
    post_type = 'BOUNTY'
    AND bounty_status IS NULL;

ALTER TABLE
    bbs_post
ADD
    CONSTRAINT chk_bbs_post_bounty_status CHECK (
        bounty_status IS NULL
        OR bounty_status IN ('ACTIVE', 'RESOLVED', 'EXPIRED')
    );

CREATE TABLE IF NOT EXISTS post_comment (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    author_id BIGINT NOT NULL,
    parent_id BIGINT,
    reply_to_user_id BIGINT,
    content TEXT NOT NULL,
    is_accepted BOOLEAN NOT NULL DEFAULT FALSE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_reason VARCHAR(255),
    deleted_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_post_comment_post FOREIGN KEY (post_id) REFERENCES bbs_post (id),
    CONSTRAINT fk_post_comment_author FOREIGN KEY (author_id) REFERENCES user_account (id),
    CONSTRAINT fk_post_comment_parent FOREIGN KEY (parent_id) REFERENCES post_comment (id),
    CONSTRAINT fk_post_comment_reply_to_user FOREIGN KEY (reply_to_user_id) REFERENCES user_account (id),
    CONSTRAINT fk_post_comment_deleted_by FOREIGN KEY (deleted_by) REFERENCES user_account (id)
);

CREATE INDEX IF NOT EXISTS idx_post_comment_post_id_created_at ON post_comment (post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_post_comment_parent_id_created_at ON post_comment (parent_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_bbs_post_bounty_status_expire_at ON bbs_post (post_type, bounty_status, bounty_expire_at);