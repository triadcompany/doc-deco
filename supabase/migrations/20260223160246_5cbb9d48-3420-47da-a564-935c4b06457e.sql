
-- Create documents table
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  pages INTEGER,
  tags TEXT[] NOT NULL DEFAULT '{}',
  favorite BOOLEAN NOT NULL DEFAULT false,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- For now, allow all operations publicly (no auth yet)
CREATE POLICY "Allow public read" ON public.documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert" ON public.documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.documents FOR UPDATE USING (true);
CREATE POLICY "Allow public delete" ON public.documents FOR DELETE USING (true);

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('pdfs', 'pdfs', true);

-- Storage policies
CREATE POLICY "Allow public upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'pdfs');
CREATE POLICY "Allow public read" ON storage.objects FOR SELECT USING (bucket_id = 'pdfs');
CREATE POLICY "Allow public delete" ON storage.objects FOR DELETE USING (bucket_id = 'pdfs');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
