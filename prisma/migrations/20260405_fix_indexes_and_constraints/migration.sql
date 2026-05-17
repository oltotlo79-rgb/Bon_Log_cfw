-- C-3: Like partial unique indexes for nullable columns
CREATE UNIQUE INDEX IF NOT EXISTS "likes_user_post_unique" ON "likes" ("user_id", "post_id") WHERE "post_id" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "likes_user_comment_unique" ON "likes" ("user_id", "comment_id") WHERE "comment_id" IS NOT NULL;

-- M-8: Comment composite index for sorted comment fetching
CREATE INDEX IF NOT EXISTS "comments_post_parent_hidden_created_idx"
  ON "comments" ("post_id", "parent_id", "is_hidden", "created_at" DESC);

-- L-1: Remove redundant indexes
DROP INDEX IF EXISTS "user_analytics_user_id_idx";
DROP INDEX IF EXISTS "user_analytics_user_id_date_idx";
DROP INDEX IF EXISTS "follows_follower_id_idx";
