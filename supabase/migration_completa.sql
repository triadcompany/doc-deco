-- ============================================================
-- MIGRAÇÃO COMPLETA - doc-deco (novo projeto Supabase)
-- Cole todo este conteúdo no SQL Editor e execute.
-- ============================================================

-- ── Função updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ── documents ────────────────────────────────────────────────
CREATE TABLE public.documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  translator TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  pages INTEGER,
  tags TEXT[] NOT NULL DEFAULT '{}',
  favorite BOOLEAN NOT NULL DEFAULT false,
  visibility TEXT NOT NULL DEFAULT 'personal',
  storage_path TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and global documents"
  ON public.documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR visibility = 'global');

CREATE POLICY "Users can insert their own documents"
  ON public.documents FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents"
  ON public.documents FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "No one can delete documents"
  ON public.documents FOR DELETE TO authenticated
  USING (false);

CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_documents_user_id_created_at ON public.documents (user_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.documents;

-- ── profiles ─────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── reading_goals ────────────────────────────────────────────
CREATE TABLE public.reading_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  monthly_docs_goal INTEGER NOT NULL DEFAULT 5,
  daily_pages_goal INTEGER NOT NULL DEFAULT 30,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, month, year)
);

ALTER TABLE public.reading_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own goals" ON public.reading_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own goals" ON public.reading_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own goals" ON public.reading_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own goals" ON public.reading_goals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_reading_goals_updated_at
  BEFORE UPDATE ON public.reading_goals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_goals;

-- ── reading_progress ─────────────────────────────────────────
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
CREATE POLICY "Users can view their own progress" ON public.reading_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own progress" ON public.reading_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own progress" ON public.reading_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own progress" ON public.reading_progress FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_reading_progress_updated_at
  BEFORE UPDATE ON public.reading_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_progress;

-- ── bible_bookmarks ──────────────────────────────────────────
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.bible_bookmarks;

-- ── bible_notes ──────────────────────────────────────────────
CREATE TABLE public.bible_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  version TEXT NOT NULL,
  book_abbrev TEXT NOT NULL,
  book_name TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER,
  note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bible_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own bible notes" ON public.bible_notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own bible notes" ON public.bible_notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own bible notes" ON public.bible_notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own bible notes" ON public.bible_notes FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bible_notes_updated_at
  BEFORE UPDATE ON public.bible_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.bible_notes;

-- ── bible_highlights ─────────────────────────────────────────
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.bible_highlights;

-- ── bible_cross_references ───────────────────────────────────
CREATE TABLE public.bible_cross_references (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  source_version TEXT NOT NULL,
  source_book_abbrev TEXT NOT NULL,
  source_book_name TEXT NOT NULL,
  source_chapter INTEGER NOT NULL,
  source_verse INTEGER NOT NULL,
  target_version TEXT NOT NULL,
  target_book_abbrev TEXT NOT NULL,
  target_book_name TEXT NOT NULL,
  target_chapter INTEGER NOT NULL,
  target_verse INTEGER NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bible_cross_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own cross references" ON public.bible_cross_references FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own cross references" ON public.bible_cross_references FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cross references" ON public.bible_cross_references FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cross references" ON public.bible_cross_references FOR DELETE USING (auth.uid() = user_id);

-- ── document_annotations ─────────────────────────────────────
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

ALTER TABLE public.document_annotations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own document annotations" ON public.document_annotations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own document annotations" ON public.document_annotations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own document annotations" ON public.document_annotations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own document annotations" ON public.document_annotations FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_document_annotations_updated_at
  BEFORE UPDATE ON public.document_annotations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_document_annotations_doc_user ON public.document_annotations(document_id, user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.document_annotations;

-- ── document_summaries ───────────────────────────────────────
CREATE TABLE public.document_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  document_ids TEXT[] DEFAULT '{}',
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL,
  folder_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.document_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own summaries" ON public.document_summaries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own summaries" ON public.document_summaries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own summaries" ON public.document_summaries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own summaries" ON public.document_summaries FOR DELETE USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_document_summaries_user_doc ON public.document_summaries(user_id, document_id) WHERE document_id IS NOT NULL;

CREATE TRIGGER update_document_summaries_updated_at
  BEFORE UPDATE ON public.document_summaries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── study_folders ────────────────────────────────────────────
CREATE TABLE public.study_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.study_folders(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.study_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own folders" ON public.study_folders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own folders" ON public.study_folders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own folders" ON public.study_folders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own folders" ON public.study_folders FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_study_folders_updated_at
  BEFORE UPDATE ON public.study_folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Adiciona foreign key de document_summaries para study_folders
ALTER TABLE public.document_summaries
  ADD CONSTRAINT fk_summaries_folder FOREIGN KEY (folder_id) REFERENCES public.study_folders(id) ON DELETE SET NULL;
