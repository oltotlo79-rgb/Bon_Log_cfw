-- RLS policies for hormone tables (read-only public data)
CREATE POLICY "Allow read access to hormone_types" ON public.hormone_types FOR SELECT USING (true);
CREATE POLICY "Allow read access to hormone_effects" ON public.hormone_effects FOR SELECT USING (true);
CREATE POLICY "Allow read access to hormone_interactions" ON public.hormone_interactions FOR SELECT USING (true);
CREATE POLICY "Allow read access to hormone_columns" ON public.hormone_columns FOR SELECT USING (true);
CREATE POLICY "Allow read access to hormone_seasonal_levels" ON public.hormone_seasonal_levels FOR SELECT USING (true);
