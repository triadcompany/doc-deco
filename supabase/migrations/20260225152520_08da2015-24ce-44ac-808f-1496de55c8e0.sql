
CREATE TABLE public.bible_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  version TEXT NOT NULL,
  book_abbrev TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  color TEXT NOT NULL DEFAULT 'yellow',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, version, book_abbrev, chapter, verse)
);

ALTER TABLE public.bible_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own highlights" ON public.bible_highlights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own highlights" ON public.bible_highlights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own highlights" ON public.bible_highlights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own highlights" ON public.bible_highlights FOR DELETE USING (auth.uid() = user_id);
