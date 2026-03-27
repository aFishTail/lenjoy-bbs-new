CREATE TABLE IF NOT EXISTS bbs_post (
    id BIGSERIAL PRIMARY KEY,
    author_id BIGINT NOT NULL,
    post_type VARCHAR(32) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    public_content TEXT,
    hidden_content TEXT,
    price INTEGER,
    bounty_amount INTEGER,
    status VARCHAR(32) NOT NULL DEFAULT 'PUBLISHED',
    offline_reason VARCHAR(255),
    offlined_at TIMESTAMP,
    offlined_by BIGINT,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bbs_post_author FOREIGN KEY (author_id) REFERENCES user_account (id),
    CONSTRAINT fk_bbs_post_offlined_by FOREIGN KEY (offlined_by) REFERENCES user_account (id),
    CONSTRAINT chk_bbs_post_type CHECK (post_type IN ('NORMAL', 'RESOURCE', 'BOUNTY')),
    CONSTRAINT chk_bbs_post_status CHECK (
        status IN ('PUBLISHED', 'CLOSED', 'OFFLINE', 'DELETED')
    )
);

CREATE INDEX IF NOT EXISTS idx_bbs_post_author_id ON bbs_post (author_id);

CREATE INDEX IF NOT EXISTS idx_bbs_post_status ON bbs_post (status);

CREATE INDEX IF NOT EXISTS idx_bbs_post_created_at ON bbs_post (created_at DESC);