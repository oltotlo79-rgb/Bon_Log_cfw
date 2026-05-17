-- CreateIndex
-- 予約投稿の公開処理Cronジョブ用複合インデックス
-- クエリ: WHERE status = 'pending' AND scheduled_at <= now()
-- 効果: テーブルスキャン → インデックススキャン（1.12秒 → 数十ms）
CREATE INDEX IF NOT EXISTS "scheduled_posts_status_scheduled_at_idx" ON "scheduled_posts"("status", "scheduled_at");
