ALTER TABLE public.document_summaries 
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ALTER COLUMN document_id DROP NOT NULL;