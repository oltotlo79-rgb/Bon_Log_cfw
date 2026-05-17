-- ============================================================
-- RLS ポリシー追加（RLS有効だがポリシーなしの5テーブル）
-- postgresロール（Prisma接続ユーザー）専用ポリシー
-- anon/authenticated ロールはアクセス拒否
-- ============================================================

CREATE POLICY "postgres_only" ON public.contact_inquiries
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.polls
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.poll_options
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.poll_votes
  FOR ALL TO postgres USING (true) WITH CHECK (true);

CREATE POLICY "postgres_only" ON public.user_hidden_posts
  FOR ALL TO postgres USING (true) WITH CHECK (true);

-- ============================================================
-- 不足している外部キーインデックスの追加
-- ============================================================

-- accounts.user_id
CREATE INDEX IF NOT EXISTS "accounts_user_id_idx" ON public.accounts ("user_id");

-- sessions.user_id
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON public.sessions ("user_id");

-- admin_logs.admin_id
CREATE INDEX IF NOT EXISTS "admin_logs_admin_id_idx" ON public.admin_logs ("admin_id");

-- bookmarks.post_id
CREATE INDEX IF NOT EXISTS "bookmarks_post_id_idx" ON public.bookmarks ("post_id");

-- comment_thread_mutes.comment_id
CREATE INDEX IF NOT EXISTS "comment_thread_mutes_comment_id_idx" ON public.comment_thread_mutes ("comment_id");

-- draft_post_genres.genre_id
CREATE INDEX IF NOT EXISTS "draft_post_genres_genre_id_idx" ON public.draft_post_genres ("genre_id");

-- events.created_by
CREATE INDEX IF NOT EXISTS "events_created_by_idx" ON public.events ("created_by");

-- likes.comment_id
CREATE INDEX IF NOT EXISTS "likes_comment_id_idx" ON public.likes ("comment_id");

-- messages.sender_id
CREATE INDEX IF NOT EXISTS "messages_sender_id_idx" ON public.messages ("sender_id");

-- notifications.actor_id
CREATE INDEX IF NOT EXISTS "notifications_actor_id_idx" ON public.notifications ("actor_id");

-- notifications.comment_id
CREATE INDEX IF NOT EXISTS "notifications_comment_id_idx" ON public.notifications ("comment_id");

-- notifications.post_id
CREATE INDEX IF NOT EXISTS "notifications_post_id_idx" ON public.notifications ("post_id");

-- poll_votes.option_id
CREATE INDEX IF NOT EXISTS "poll_votes_option_id_idx" ON public.poll_votes ("option_id");

-- post_genres.genre_id
CREATE INDEX IF NOT EXISTS "post_genres_genre_id_idx" ON public.post_genres ("genre_id");

-- post_hashtags.hashtag_id
CREATE INDEX IF NOT EXISTS "post_hashtags_hashtag_id_idx" ON public.post_hashtags ("hashtag_id");

-- posts.quote_post_id
CREATE INDEX IF NOT EXISTS "posts_quote_post_id_idx" ON public.posts ("quote_post_id");

-- posts.repost_post_id
CREATE INDEX IF NOT EXISTS "posts_repost_post_id_idx" ON public.posts ("repost_post_id");

-- reports.reporter_id
CREATE INDEX IF NOT EXISTS "reports_reporter_id_idx" ON public.reports ("reporter_id");

-- scheduled_post_genres.genre_id
CREATE INDEX IF NOT EXISTS "scheduled_post_genres_genre_id_idx" ON public.scheduled_post_genres ("genre_id");

-- shop_genres.genre_id
CREATE INDEX IF NOT EXISTS "shop_genres_genre_id_idx" ON public.shop_genres ("genre_id");

-- user_hidden_posts.post_id
CREATE INDEX IF NOT EXISTS "user_hidden_posts_post_id_idx" ON public.user_hidden_posts ("post_id");

-- Prismaスキーマに定義済みだがDBに存在しなかったインデックス
CREATE INDEX IF NOT EXISTS "blocks_blocked_id_idx" ON public.blocks ("blocked_id");
CREATE INDEX IF NOT EXISTS "comments_parent_id_idx" ON public.comments ("parent_id");
CREATE INDEX IF NOT EXISTS "conversation_participants_user_id_idx" ON public.conversation_participants ("user_id");
CREATE INDEX IF NOT EXISTS "mutes_muted_id_idx" ON public.mutes ("muted_id");
CREATE INDEX IF NOT EXISTS "post_media_post_id_idx" ON public.post_media ("post_id");
CREATE INDEX IF NOT EXISTS "shop_reviews_shop_id_idx" ON public.shop_reviews ("shop_id");
CREATE INDEX IF NOT EXISTS "shop_reviews_user_id_idx" ON public.shop_reviews ("user_id");

-- ============================================================
-- verification_tokens: 主キー追加 + 重複ユニークインデックス削除
-- ============================================================
ALTER TABLE public.verification_tokens
  ADD CONSTRAINT verification_tokens_pkey PRIMARY KEY (identifier, token);
DROP INDEX IF EXISTS public.verification_tokens_identifier_token_key;
