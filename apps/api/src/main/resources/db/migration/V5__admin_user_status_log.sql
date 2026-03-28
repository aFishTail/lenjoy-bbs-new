CREATE TABLE IF NOT EXISTS admin_user_status_log (
    id BIGSERIAL PRIMARY KEY,
    target_user_id BIGINT NOT NULL,
    old_status VARCHAR(32) NOT NULL,
    new_status VARCHAR(32) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    operated_by BIGINT NOT NULL,
    operated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_admin_user_status_log_target_user FOREIGN KEY (target_user_id) REFERENCES user_account (id),
    CONSTRAINT fk_admin_user_status_log_operator FOREIGN KEY (operated_by) REFERENCES user_account (id)
);

CREATE INDEX IF NOT EXISTS idx_admin_user_status_log_target_user_id ON admin_user_status_log (target_user_id);

CREATE INDEX IF NOT EXISTS idx_admin_user_status_log_operated_by ON admin_user_status_log (operated_by);

CREATE INDEX IF NOT EXISTS idx_admin_user_status_log_operated_at ON admin_user_status_log (operated_at DESC);