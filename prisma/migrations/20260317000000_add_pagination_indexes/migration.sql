-- ================================================================
-- ページネーション用複合インデックス追加
--
-- 目的:
--   カーソルベースページネーションの ORDER BY created_at DESC/ASC を
--   インデックスのみで解決し、in-memory ソート（filesort）を排除する。
--
-- 対象クエリ:
--   - getLikedPosts:       WHERE user_id = ? ORDER BY created_at DESC
--   - getBookmarkedPosts:  WHERE user_id = ? ORDER BY created_at DESC
--   - getNotifications:   WHERE user_id = ? ORDER BY created_at DESC
--   - getMessages (DM):   WHERE conversation_id = ? ORDER BY created_at ASC
-- ================================================================

-- ----------------------------------------------------------------
-- likes テーブル: ユーザーのいいね一覧ページネーション
-- ----------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "likes_user_id_created_at_idx"
ON "likes" ("user_id", "created_at" DESC);

-- ----------------------------------------------------------------
-- bookmarks テーブル: ブックマーク一覧ページネーション
-- ----------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "bookmarks_user_id_created_at_idx"
ON "bookmarks" ("user_id", "created_at" DESC);

-- ----------------------------------------------------------------
-- notifications テーブル: 通知一覧ページネーション
-- ----------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_user_id_created_at_idx"
ON "notifications" ("user_id", "created_at" DESC);

-- ----------------------------------------------------------------
-- messages テーブル: DM 会話内メッセージ履歴ページネーション
-- ----------------------------------------------------------------
CREATE INDEX CONCURRENTLY IF NOT EXISTS "messages_conversation_id_created_at_idx"
ON "messages" ("conversation_id", "created_at" ASC);
