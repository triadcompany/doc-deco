
-- Bible bookmarks (favorite verses)
CREATE TABLE public.bible_bookmarks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  version TEXT NOT NULL,
  book_abbrev TEXT NOT NULL,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  verse_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bible_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bible bookmarks" ON public.bible_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bible bookmarks" ON public.bible_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bible bookmarks" ON public.bible_bookmarks FOR DELETE USING (auth.uid() = user_id);

-- Bible notes
CREATE TABLE public.bible_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  version TEXT NOT NULL,
  book_abbrev TEXT NOT NULL,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bible_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bible notes" ON public.bible_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bible notes" ON public.bible_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bible notes" ON public.bible_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bible notes" ON public.bible_notes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bible_notes_updated_at BEFORE UPDATE ON public.bible_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
