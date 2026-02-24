
-- Drop all restrictive policies
DROP POLICY IF EXISTS "Allow public delete" ON public.documents;
DROP POLICY IF EXISTS "Allow public insert" ON public.documents;
DROP POLICY IF EXISTS "Allow public read" ON public.documents;
DROP POLICY IF EXISTS "Allow public update" ON public.documents;

-- Recreate as permissive
CREATE POLICY "Allow public read" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.documents FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.documents FOR DELETE USING (true);
