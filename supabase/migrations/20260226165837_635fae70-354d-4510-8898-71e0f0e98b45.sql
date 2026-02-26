
-- Cross-references between Bible verses
CREATE TABLE public.bible_cross_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  -- Source verse
  source_version TEXT NOT NULL,
  source_book_abbrev TEXT NOT NULL,
  source_book_name TEXT NOT NULL,
  source_chapter INTEGER NOT NULL,
  source_verse INTEGER NOT NULL,
  -- Target verse
  target_version TEXT NOT NULL,
  target_book_abbrev TEXT NOT NULL,
  target_book_name TEXT NOT NULL,
  target_chapter INTEGER NOT NULL,
  target_verse INTEGER NOT NULL,
  -- Optional note about the connection
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bible_cross_references ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cross references"
ON public.bible_cross_references FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cross references"
ON public.bible_cross_references FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cross references"
ON public.bible_cross_references FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cross references"
ON public.bible_cross_references FOR DELETE
USING (auth.uid() = user_id);
