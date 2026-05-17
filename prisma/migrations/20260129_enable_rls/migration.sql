-- Enable Row Level Security on all public tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonsai_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_review_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_post_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_post_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonsais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonsai_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonsai_record_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_blacklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._prisma_migrations ENABLE ROW LEVEL SECURITY;

-- Allow the application database user full access (bypass RLS)
-- Prisma connects as the DB owner, so RLS won't block application queries.
-- If using a non-owner role, create policies like:
-- CREATE POLICY "allow_app_access" ON public.users FOR ALL USING (true);
