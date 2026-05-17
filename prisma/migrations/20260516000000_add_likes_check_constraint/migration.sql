-- 「post_id と comment_id はどちらか一方だけ必須」を DB レベルで強制する。
--
-- 背景: アプリケーション層 (`lib/actions/like.ts`) は常に片方のみセットしているが、
-- 直接 SQL / seed / 将来の admin 操作で不正行が入る余地が残っていた。
-- 不正行検出 / 防止のため CHECK 制約を追加する。
--
-- 既存データ検証: 既に不正行が残っている場合 ALTER TABLE は失敗するため、
-- まず違反件数を SELECT で確認できるようコメントに残す:
--   SELECT COUNT(*) FROM likes
--     WHERE (post_id IS NULL AND comment_id IS NULL)
--        OR (post_id IS NOT NULL AND comment_id IS NOT NULL);

ALTER TABLE "likes"
  ADD CONSTRAINT "likes_post_xor_comment"
  CHECK ((post_id IS NOT NULL AND comment_id IS NULL) OR (post_id IS NULL AND comment_id IS NOT NULL));
