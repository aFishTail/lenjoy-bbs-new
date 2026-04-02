ALTER TABLE bbs_post
ADD COLUMN IF NOT EXISTS category_id BIGINT;

CREATE TABLE IF NOT EXISTS bbs_category (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    parent_id BIGINT NOT NULL DEFAULT 0,
    content_type VARCHAR(32) NOT NULL,
    sort INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    is_leaf BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_bbs_category_content_type CHECK (content_type IN ('NORMAL', 'RESOURCE', 'BOUNTY')),
    CONSTRAINT chk_bbs_category_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_bbs_category_slug_content_type ON bbs_category (slug, content_type);
CREATE INDEX IF NOT EXISTS idx_bbs_category_content_type_parent ON bbs_category (content_type, parent_id, sort ASC, id ASC);

ALTER TABLE bbs_post
ADD CONSTRAINT fk_bbs_post_category
FOREIGN KEY (category_id) REFERENCES bbs_category (id);

CREATE INDEX IF NOT EXISTS idx_bbs_post_category_id ON bbs_post (category_id);

CREATE TABLE IF NOT EXISTS bbs_tag (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    source VARCHAR(32) NOT NULL DEFAULT 'SYSTEM',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_bbs_tag_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'MERGED')),
    CONSTRAINT chk_bbs_tag_source CHECK (source IN ('SYSTEM', 'CUSTOM'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_bbs_tag_slug ON bbs_tag (slug);

CREATE TABLE IF NOT EXISTS bbs_post_tag (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bbs_post_tag_post FOREIGN KEY (post_id) REFERENCES bbs_post (id) ON DELETE CASCADE,
    CONSTRAINT fk_bbs_post_tag_tag FOREIGN KEY (tag_id) REFERENCES bbs_tag (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_bbs_post_tag_post_id_tag_id ON bbs_post_tag (post_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_bbs_post_tag_tag_id ON bbs_post_tag (tag_id);

CREATE TABLE IF NOT EXISTS bbs_tag_alias (
    id BIGSERIAL PRIMARY KEY,
    tag_id BIGINT NOT NULL,
    alias_name VARCHAR(100) NOT NULL,
    normalized_alias VARCHAR(120) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_bbs_tag_alias_tag FOREIGN KEY (tag_id) REFERENCES bbs_tag (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_bbs_tag_alias_normalized_alias ON bbs_tag_alias (normalized_alias);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '交流区', 'discussion-general', 0, 'NORMAL', 10, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'NORMAL' AND slug = 'discussion-general'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '求助区', 'discussion-help', 0, 'NORMAL', 20, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'NORMAL' AND slug = 'discussion-help'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '公告区', 'discussion-announcement', 0, 'NORMAL', 30, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'NORMAL' AND slug = 'discussion-announcement'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '灌水区', 'discussion-casual', 0, 'NORMAL', 40, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'NORMAL' AND slug = 'discussion-casual'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '软件工具', 'resource-software', 0, 'RESOURCE', 10, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'RESOURCE' AND slug = 'resource-software'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '学习教程', 'resource-course', 0, 'RESOURCE', 20, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'RESOURCE' AND slug = 'resource-course'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '电子书', 'resource-book', 0, 'RESOURCE', 30, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'RESOURCE' AND slug = 'resource-book'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '影视动漫', 'resource-video', 0, 'RESOURCE', 40, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'RESOURCE' AND slug = 'resource-video'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '设计素材', 'resource-design', 0, 'RESOURCE', 50, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'RESOURCE' AND slug = 'resource-design'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '脚本源码', 'resource-code', 0, 'RESOURCE', 60, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'RESOURCE' AND slug = 'resource-code'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '其他资源', 'resource-other', 0, 'RESOURCE', 70, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'RESOURCE' AND slug = 'resource-other'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '技术求助', 'bounty-tech', 0, 'BOUNTY', 10, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'BOUNTY' AND slug = 'bounty-tech'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '设计需求', 'bounty-design', 0, 'BOUNTY', 20, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'BOUNTY' AND slug = 'bounty-design'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '资源求档', 'bounty-resource', 0, 'BOUNTY', 30, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'BOUNTY' AND slug = 'bounty-resource'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '脚本开发', 'bounty-script', 0, 'BOUNTY', 40, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'BOUNTY' AND slug = 'bounty-script'
);

INSERT INTO bbs_category (name, slug, parent_id, content_type, sort, status, is_leaf)
SELECT '文案写作', 'bounty-copywriting', 0, 'BOUNTY', 50, 'ACTIVE', TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM bbs_category WHERE content_type = 'BOUNTY' AND slug = 'bounty-copywriting'
);

INSERT INTO bbs_tag (name, slug, status, source)
SELECT 'AI', 'ai', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'ai');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '办公', 'office', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'office');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '剪辑', 'video-editing', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'video-editing');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '编程', 'programming', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'programming');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '设计', 'design', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'design');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '运营', 'operations', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'operations');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '教程', 'tutorial', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'tutorial');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '入门', 'beginner', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'beginner');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '进阶', 'advanced', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'advanced');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT 'Windows', 'windows', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'windows');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT 'Mac', 'mac', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'mac');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT 'Android', 'android', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'android');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT 'iOS', 'ios', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'ios');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '百度网盘', 'baidu-pan', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'baidu-pan');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '阿里云盘', 'aliyun-pan', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'aliyun-pan');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '夸克网盘', 'quark-pan', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'quark-pan');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '免费', 'free', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'free');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '中文版', 'chinese-version', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'chinese-version');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '绿色版', 'portable', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'portable');

INSERT INTO bbs_tag (name, slug, status, source)
SELECT '破解', 'cracked', 'ACTIVE', 'SYSTEM'
WHERE NOT EXISTS (SELECT 1 FROM bbs_tag WHERE slug = 'cracked');
