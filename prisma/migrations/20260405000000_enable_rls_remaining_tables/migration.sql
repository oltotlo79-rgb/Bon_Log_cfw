-- Enable Row Level Security on all remaining tables
-- These tables were added after the initial RLS migration

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonsai_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_page_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_thread_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilization_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_nutrients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ng_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesticide_data_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesticide_incompatibilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pesticide_spreader_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tree_species ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_hidden_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- Create default policies allowing access through Prisma (service role)
-- Supabase uses service_role key which bypasses RLS,
-- so these policies only affect direct PostgREST/anon access

-- Read-only public data (reference tables)
CREATE POLICY "Allow read access to fertilizer_nutrients" ON public.fertilizer_nutrients FOR SELECT USING (true);
CREATE POLICY "Allow read access to fertilizer_categories" ON public.fertilizer_categories FOR SELECT USING (true);
CREATE POLICY "Allow read access to fertilizer_columns" ON public.fertilizer_columns FOR SELECT USING (true);
CREATE POLICY "Allow read access to fertilization_plans" ON public.fertilization_plans FOR SELECT USING (true);
CREATE POLICY "Allow read access to tree_species" ON public.tree_species FOR SELECT USING (true);
CREATE POLICY "Allow read access to bonsai_terms" ON public.bonsai_terms FOR SELECT USING (true);
CREATE POLICY "Allow read access to ng_words" ON public.ng_words FOR SELECT USING (true);
CREATE POLICY "Allow read access to pesticide_incompatibilities" ON public.pesticide_incompatibilities FOR SELECT USING (true);
CREATE POLICY "Allow read access to pesticide_spreader_types" ON public.pesticide_spreader_types FOR SELECT USING (true);

-- Poll data (read-only for all, write requires auth via Prisma)
CREATE POLICY "Allow read access to polls" ON public.polls FOR SELECT USING (true);
CREATE POLICY "Allow read access to poll_options" ON public.poll_options FOR SELECT USING (true);
CREATE POLICY "Allow read access to poll_votes" ON public.poll_votes FOR SELECT USING (true);

-- Announcements (read-only for active ones)
CREATE POLICY "Allow read active announcements" ON public.announcements FOR SELECT USING (true);

-- CMS pages (read published only)
CREATE POLICY "Allow read published cms_pages" ON public.cms_pages FOR SELECT USING (true);
CREATE POLICY "Allow read cms_page_versions" ON public.cms_page_versions FOR SELECT USING (true);

-- Contact inquiries (no public access)
CREATE POLICY "Deny anon access to contact_inquiries" ON public.contact_inquiries FOR SELECT USING (false);

-- Admin/security tables (no public access)
CREATE POLICY "Deny anon access to moderation_queue" ON public.moderation_queue FOR SELECT USING (false);
CREATE POLICY "Deny anon access to security_events" ON public.security_events FOR SELECT USING (false);
CREATE POLICY "Deny anon access to user_warnings" ON public.user_warnings FOR SELECT USING (false);
CREATE POLICY "Deny anon access to user_segments" ON public.user_segments FOR SELECT USING (false);
CREATE POLICY "Deny anon access to pesticide_data_history" ON public.pesticide_data_history FOR SELECT USING (false);

-- User-specific tables (no public access)
CREATE POLICY "Deny anon access to comment_thread_mutes" ON public.comment_thread_mutes FOR SELECT USING (false);
CREATE POLICY "Deny anon access to user_hidden_posts" ON public.user_hidden_posts FOR SELECT USING (false);
CREATE POLICY "Deny anon access to push_subscriptions" ON public.push_subscriptions FOR SELECT USING (false);
