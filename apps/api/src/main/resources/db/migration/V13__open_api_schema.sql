CREATE TABLE IF NOT EXISTS open_api_client (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    api_key VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    remark VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_open_api_client_api_key UNIQUE (api_key),
    CONSTRAINT chk_open_api_client_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE IF NOT EXISTS open_api_account_binding (
    id BIGSERIAL PRIMARY KEY,
    client_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    binding_code VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    remark VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_open_api_binding_client FOREIGN KEY (client_id) REFERENCES open_api_client (id),
    CONSTRAINT fk_open_api_binding_user FOREIGN KEY (user_id) REFERENCES user_account (id),
    CONSTRAINT uk_open_api_binding_code UNIQUE (binding_code),
    CONSTRAINT chk_open_api_binding_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_open_api_binding_client_id
    ON open_api_account_binding (client_id);

CREATE INDEX IF NOT EXISTS idx_open_api_binding_user_id
    ON open_api_account_binding (user_id);
