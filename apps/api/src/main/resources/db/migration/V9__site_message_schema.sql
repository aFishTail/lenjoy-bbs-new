CREATE TABLE IF NOT EXISTS site_message (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    message_type VARCHAR(64) NOT NULL,
    title VARCHAR(120) NOT NULL,
    content VARCHAR(500) NOT NULL,
    biz_type VARCHAR(64),
    biz_id BIGINT,
    related_post_id BIGINT,
    related_purchase_id BIGINT,
    related_appeal_id BIGINT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_site_message_user FOREIGN KEY (user_id) REFERENCES user_account (id),
    CONSTRAINT fk_site_message_post FOREIGN KEY (related_post_id) REFERENCES bbs_post (id),
    CONSTRAINT fk_site_message_purchase FOREIGN KEY (related_purchase_id) REFERENCES resource_purchase (id),
    CONSTRAINT fk_site_message_appeal FOREIGN KEY (related_appeal_id) REFERENCES resource_appeal (id)
);

CREATE INDEX IF NOT EXISTS idx_site_message_user_id_created_at ON site_message (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_site_message_user_id_is_read ON site_message (user_id, is_read, created_at DESC);