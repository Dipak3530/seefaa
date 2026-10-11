DROP POLICY "public read" ON public.modules;
CREATE POLICY "authenticated read" ON public.modules FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY "public read" ON public.subjects;
CREATE POLICY "authenticated read" ON public.subjects FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY "public read" ON public.curriculum_versions;
CREATE POLICY "authenticated read" ON public.curriculum_versions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY "public read" ON public.los;
CREATE POLICY "authenticated read" ON public.los FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY "public read" ON public.xp_config;
CREATE POLICY "authenticated read" ON public.xp_config FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);