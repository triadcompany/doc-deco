
-- Create study_folders table
CREATE TABLE public.study_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.study_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.study_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own folders"
ON public.study_folders FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folders"
ON public.study_folders FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folders"
ON public.study_folders FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own folders"
ON public.study_folders FOR DELETE USING (auth.uid() = user_id);

-- Add folder_id to document_summaries
ALTER TABLE public.document_summaries
ADD COLUMN folder_id UUID REFERENCES public.study_folders(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_study_folders_updated_at
BEFORE UPDATE ON public.study_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
