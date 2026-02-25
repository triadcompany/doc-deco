
CREATE TABLE public.document_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  summary TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.document_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own summaries" ON public.document_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own summaries" ON public.document_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own summaries" ON public.document_summaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own summaries" ON public.document_summaries FOR DELETE USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_document_summaries_user_doc ON public.document_summaries(user_id, document_id);

CREATE TRIGGER update_document_summaries_updated_at
  BEFORE UPDATE ON public.document_summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
