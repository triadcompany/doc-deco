
-- Table to store reading goals
CREATE TABLE public.reading_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month INTEGER NOT NULL, -- 1-12
  year INTEGER NOT NULL,
  monthly_docs_goal INTEGER NOT NULL DEFAULT 5,
  daily_pages_goal INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.reading_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals"
  ON public.reading_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON public.reading_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.reading_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.reading_goals FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_reading_goals_updated_at
  BEFORE UPDATE ON public.reading_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Table to track reading progress (current readings + pages read)
CREATE TABLE public.reading_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  current_page INTEGER NOT NULL DEFAULT 0,
  is_reading BOOLEAN NOT NULL DEFAULT true,
  completed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, document_id)
);

ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress"
  ON public.reading_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own progress"
  ON public.reading_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress"
  ON public.reading_progress FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own progress"
  ON public.reading_progress FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_reading_progress_updated_at
  BEFORE UPDATE ON public.reading_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
