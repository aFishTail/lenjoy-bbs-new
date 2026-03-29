CREATE TABLE IF NOT EXISTS wallet (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE,
    available_coins INTEGER NOT NULL DEFAULT 0,
    frozen_coins INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES user_account (id),
    CONSTRAINT chk_wallet_available_coins CHECK (available_coins >= 0),
    CONSTRAINT chk_wallet_frozen_coins CHECK (frozen_coins >= 0)
);

CREATE TABLE IF NOT EXISTS wallet_ledger (
    id BIGSERIAL PRIMARY KEY,
    wallet_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    direction VARCHAR(32) NOT NULL,
    change_amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    frozen_after INTEGER NOT NULL,
    biz_type VARCHAR(64) NOT NULL,
    biz_key VARCHAR(128),
    remark VARCHAR(255),
    operated_by BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_ledger_wallet FOREIGN KEY (wallet_id) REFERENCES wallet (id),
    CONSTRAINT fk_wallet_ledger_user FOREIGN KEY (user_id) REFERENCES user_account (id),
    CONSTRAINT fk_wallet_ledger_operator FOREIGN KEY (operated_by) REFERENCES user_account (id),
    CONSTRAINT chk_wallet_ledger_direction CHECK (
        direction IN ('INCOME', 'EXPENSE', 'FREEZE', 'UNFREEZE')
    ),
    CONSTRAINT chk_wallet_ledger_change_amount CHECK (change_amount > 0),
    CONSTRAINT chk_wallet_ledger_balance_after CHECK (balance_after >= 0),
    CONSTRAINT chk_wallet_ledger_frozen_after CHECK (frozen_after >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_wallet_ledger_biz_key ON wallet_ledger (biz_key)
WHERE
    biz_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_user_id_created_at ON wallet_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_ledger_wallet_id_created_at ON wallet_ledger (wallet_id, created_at DESC);