ALTER TABLE public.document_summaries ADD COLUMN IF NOT EXISTS document_ids text[] DEFAULT '{}';

UPDATE public.document_summaries SET document_ids = ARRAY[document_id::text] WHERE document_ids = '{}' OR document_ids IS NULL;