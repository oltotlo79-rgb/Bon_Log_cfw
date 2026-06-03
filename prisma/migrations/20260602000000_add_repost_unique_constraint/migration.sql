-- 同一ユーザーによる同一投稿への重複リポストを DB レベルで一意化する。
--
-- 背景: アプリ層 (`lib/actions/post.ts` の createRepost) は同一トランザクション内の
-- re-check で重複を抑止していたが、PostgreSQL の READ COMMITTED 下では「存在しない行」の
-- 二重チェックだけでは並行 insert を直列化できず、連打・競合で二重リポストが作られ得た。
-- unique 制約を最終防衛線として追加する。
--
-- 通常投稿は repost_post_id IS NULL となり、PostgreSQL は NULL を相異なる値として扱うため
-- (user_id, NULL) は複数行許容される。非 NULL のリポストのみが一意化される。

-- 既存の重複リポストを最古の1件に統合する。まず created_at が新しい重複を削除。
DELETE FROM "posts" p
USING (
  SELECT user_id, repost_post_id, MIN(created_at) AS keep_created_at
  FROM "posts"
  WHERE repost_post_id IS NOT NULL
  GROUP BY user_id, repost_post_id
  HAVING COUNT(*) > 1
) dup
WHERE p.user_id = dup.user_id
  AND p.repost_post_id = dup.repost_post_id
  AND p.created_at > dup.keep_created_at;

-- created_at が同値で残った重複は ctid で最終的に1件へ収束させる。
DELETE FROM "posts" a
USING "posts" b
WHERE a.repost_post_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.repost_post_id = b.repost_post_id
  AND a.created_at = b.created_at
  AND a.ctid > b.ctid;

-- Prisma の @@unique([userId, repostPostId]) と等価な unique index を作成する。
CREATE UNIQUE INDEX "posts_user_id_repost_post_id_key"
  ON "posts" ("user_id", "repost_post_id");
