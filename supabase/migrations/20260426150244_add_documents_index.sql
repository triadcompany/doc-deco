CREATE INDEX idx_documents_user_id_created_at ON public.documents (user_id, created_at DESC);
