
-- Table for user-specific highlights/annotations on PDF documents
CREATE TABLE public.document_annotations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  page INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'yellow',
  note TEXT,
  position JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.document_annotations ENABLE ROW LEVEL SECURITY;

-- Each user can only see/manage their own annotations
CREATE POLICY "Users can view their own document annotations"
  ON public.document_annotations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own document annotations"
  ON public.document_annotations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own document annotations"
  ON public.document_annotations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own document annotations"
  ON public.document_annotations FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_document_annotations_updated_at
  BEFORE UPDATE ON public.document_annotations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_document_annotations_doc_user ON public.document_annotations(document_id, user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_annotations;
