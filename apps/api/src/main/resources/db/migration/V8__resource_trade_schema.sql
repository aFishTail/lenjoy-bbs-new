CREATE TABLE IF NOT EXISTS resource_purchase (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    buyer_id BIGINT NOT NULL,
    seller_id BIGINT NOT NULL,
    price INTEGER NOT NULL,
    refunded_amount INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    refunded_at TIMESTAMP,
    CONSTRAINT fk_resource_purchase_post FOREIGN KEY (post_id) REFERENCES bbs_post (id),
    CONSTRAINT fk_resource_purchase_buyer FOREIGN KEY (buyer_id) REFERENCES user_account (id),
    CONSTRAINT fk_resource_purchase_seller FOREIGN KEY (seller_id) REFERENCES user_account (id),
    CONSTRAINT uk_resource_purchase_post_buyer UNIQUE (post_id, buyer_id),
    CONSTRAINT chk_resource_purchase_price CHECK (price > 0),
    CONSTRAINT chk_resource_purchase_refunded CHECK (
        refunded_amount >= 0
        AND refunded_amount <= price
    ),
    CONSTRAINT chk_resource_purchase_status CHECK (
        status IN ('PAID', 'PARTIAL_REFUNDED', 'REFUNDED')
    )
);

CREATE TABLE IF NOT EXISTS resource_appeal (
    id BIGSERIAL PRIMARY KEY,
    purchase_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    buyer_id BIGINT NOT NULL,
    seller_id BIGINT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    detail TEXT,
    status VARCHAR(32) NOT NULL,
    requested_refund_amount INTEGER NOT NULL,
    resolved_refund_amount INTEGER NOT NULL DEFAULT 0,
    resolution_note VARCHAR(255),
    resolved_by BIGINT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resource_appeal_purchase FOREIGN KEY (purchase_id) REFERENCES resource_purchase (id),
    CONSTRAINT fk_resource_appeal_post FOREIGN KEY (post_id) REFERENCES bbs_post (id),
    CONSTRAINT fk_resource_appeal_buyer FOREIGN KEY (buyer_id) REFERENCES user_account (id),
    CONSTRAINT fk_resource_appeal_seller FOREIGN KEY (seller_id) REFERENCES user_account (id),
    CONSTRAINT fk_resource_appeal_resolved_by FOREIGN KEY (resolved_by) REFERENCES user_account (id),
    CONSTRAINT uk_resource_appeal_purchase UNIQUE (purchase_id),
    CONSTRAINT chk_resource_appeal_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT chk_resource_appeal_requested_amount CHECK (requested_refund_amount > 0),
    CONSTRAINT chk_resource_appeal_resolved_amount CHECK (resolved_refund_amount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_resource_purchase_buyer_id_created_at ON resource_purchase (buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resource_purchase_seller_id_created_at ON resource_purchase (seller_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resource_appeal_status_created_at ON resource_appeal (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resource_appeal_buyer_id_created_at ON resource_appeal (buyer_id, created_at DESC);