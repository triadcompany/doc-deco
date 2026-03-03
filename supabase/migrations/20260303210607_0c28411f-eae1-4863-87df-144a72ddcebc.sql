DROP POLICY IF EXISTS "Users can delete their own documents" ON public.documents;

CREATE POLICY "No one can delete documents"
ON public.documents FOR DELETE
TO authenticated
USING (false);