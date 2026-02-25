
-- Add visibility column
ALTER TABLE public.documents ADD COLUMN visibility TEXT NOT NULL DEFAULT 'personal';

-- Drop existing user-scoped policies
DROP POLICY IF EXISTS "Users can view their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON public.documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

-- SELECT: user sees own docs + all global docs
CREATE POLICY "Users can view own and global documents"
  ON public.documents FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR visibility = 'global');

-- INSERT: user can only insert their own docs
CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: user can only update their own docs
CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- DELETE: user can only delete their own docs
CREATE POLICY "Users can delete their own documents"
  ON public.documents FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
