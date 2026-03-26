-- Initial schema placeholder for Lenjoy BBS.
-- Keep this migration minimal; add domain tables in subsequent versions.
CREATE TABLE IF NOT EXISTS schema_version_note (
    id BIGSERIAL PRIMARY KEY,
    note VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO
    schema_version_note (note)
VALUES
    ('Initial migration applied') ON CONFLICT DO NOTHING;