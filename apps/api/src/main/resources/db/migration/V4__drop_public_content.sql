-- 删除不再需要的 public_content 字段
ALTER TABLE bbs_post DROP COLUMN IF EXISTS public_content;