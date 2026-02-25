import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

const GITHUB_BASE = 'https://raw.githubusercontent.com/maatheusgois/bible/main/versions/pt-br';

export interface BibleBook {
  abbrev: string;
  name: string;
  chapters: number;
  testament: 'VT' | 'NT';
}

export interface BibleVerse {
  number: number;
  text: string;
}

export interface BibleSearchResult {
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleBookmark {
  id: string;
  version: string;
  book_abbrev: string;
  book_name: string;
  chapter: number;
  verse: number;
  verse_text: string;
  created_at: string;
}

export interface BibleNote {
  id: string;
  version: string;
  book_abbrev: string;
  book_name: string;
  chapter: number;
  verse: number | null;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface BibleHighlight {
  id: string;
  version: string;
  book_abbrev: string;
  chapter: number;
  verse: number;
  color: string;
  created_at: string;
}

export const HIGHLIGHT_COLORS = [
  { value: 'yellow', label: 'Amarelo', bg: 'bg-yellow-200/40', text: 'text-yellow-600', dot: 'bg-yellow-400' },
  { value: 'green', label: 'Verde', bg: 'bg-green-200/40', text: 'text-green-600', dot: 'bg-green-400' },
  { value: 'blue', label: 'Azul', bg: 'bg-blue-200/40', text: 'text-blue-600', dot: 'bg-blue-400' },
  { value: 'pink', label: 'Rosa', bg: 'bg-pink-200/40', text: 'text-pink-600', dot: 'bg-pink-400' },
  { value: 'orange', label: 'Laranja', bg: 'bg-orange-200/40', text: 'text-orange-600', dot: 'bg-orange-400' },
  { value: 'purple', label: 'Roxo', bg: 'bg-purple-200/40', text: 'text-purple-600', dot: 'bg-purple-400' },
];

export const BIBLE_VERSIONS = [
  { value: 'arc', label: 'ARC - Almeida Revista e Corrigida' },
  { value: 'acf', label: 'ACF - Almeida Corrigida e Fiel' },
  { value: 'nvi', label: 'NVI - Nova Versão Internacional' },
  { value: 'aa', label: 'AA - Almeida Revisada Imprensa Bíblica' },
  { value: 'kja', label: 'KJA - King James Atualizada' },
];

// NT book IDs for testament detection
const NT_IDS = new Set(['mt', 'mc', 'lc', 'jo', 'at', 'rm', '1co', '2co', 'gl', 'ef', 'fp', 'cl', '1ts', '2ts', '1tm', '2tm', 'tt', 'fm', 'hb', 'tg', '1pe', '2pe', '1jo', '2jo', '3jo', 'jd', 'ap']);

interface RawBook {
  id: string;
  name: string;
  chapters: string[][];
}

export function useBible() {
  const { user } = useAuth();
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [searchResults, setSearchResults] = useState<BibleSearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [bookmarks, setBookmarks] = useState<BibleBookmark[]>([]);
  const [highlights, setHighlights] = useState<BibleHighlight[]>([]);
  const [notes, setNotes] = useState<BibleNote[]>([]);
  const [currentBookInfo, setCurrentBookInfo] = useState<{ name: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Cache loaded bible data per version
  const bibleCache = useRef<Record<string, RawBook[]>>({});

  const loadBible = useCallback(async (version: string): Promise<RawBook[]> => {
    if (bibleCache.current[version]) return bibleCache.current[version];
    const url = `${GITHUB_BASE}/${version}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${version}`);
    const data: RawBook[] = await res.json();
    bibleCache.current[version] = data;
    return data;
  }, []);

  // Load books list from default version
  const fetchBooks = useCallback(async (version: string) => {
    setLoadingBooks(true);
    try {
      const data = await loadBible(version);
      setBooks(data.map((b, index) => ({
        abbrev: b.id,
        name: b.name,
        chapters: b.chapters.length,
        testament: index < 39 ? 'VT' : 'NT',
      })));
    } catch (err) {
      console.error('Error loading bible:', err);
    } finally {
      setLoadingBooks(false);
    }
  }, [loadBible]);

  // Fetch chapter
  const fetchChapter = useCallback(async (version: string, abbrev: string, chapter: number) => {
    setLoadingVerses(true);
    setFetchError(null);
    try {
      const data = await loadBible(version);
      const book = data.find(b => b.id === abbrev);
      if (!book) { setFetchError('Livro não encontrado'); setVerses([]); return; }
      const chapterIdx = chapter - 1;
      if (chapterIdx < 0 || chapterIdx >= book.chapters.length) {
        setFetchError('Capítulo não encontrado'); setVerses([]); return;
      }
      const chapterVerses = book.chapters[chapterIdx];
      setVerses(chapterVerses.map((text, i) => ({ number: i + 1, text: text.trim() })));
      setCurrentBookInfo({ name: book.name });
    } catch (err) {
      console.error('Error fetching chapter:', err);
      setFetchError('Erro ao carregar capítulo');
      setVerses([]);
    } finally {
      setLoadingVerses(false);
    }
  }, [loadBible]);

  // Search
  const searchVerses = useCallback(async (version: string, term: string) => {
    if (!term.trim()) return;
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      const data = await loadBible(version);
      const lowerTerm = term.toLowerCase();
      const results: BibleSearchResult[] = [];
      for (const book of data) {
        for (let ci = 0; ci < book.chapters.length; ci++) {
          for (let vi = 0; vi < book.chapters[ci].length; vi++) {
            if (book.chapters[ci][vi].toLowerCase().includes(lowerTerm)) {
              results.push({
                book_name: book.name,
                chapter: ci + 1,
                verse: vi + 1,
                text: book.chapters[ci][vi].trim(),
              });
              if (results.length >= 50) break;
            }
          }
          if (results.length >= 50) break;
        }
        if (results.length >= 50) break;
      }
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoadingSearch(false);
    }
  }, [loadBible]);

  // Bookmarks
  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('bible_bookmarks').select('*').order('created_at', { ascending: false });
    if (data) setBookmarks(data as BibleBookmark[]);
  }, [user]);

  const addBookmark = useCallback(async (bm: Omit<BibleBookmark, 'id' | 'created_at'>) => {
    if (!user) return;
    await supabase.from('bible_bookmarks').insert({ ...bm, user_id: user.id });
    fetchBookmarks();
  }, [user, fetchBookmarks]);

  const removeBookmark = useCallback(async (id: string) => {
    await supabase.from('bible_bookmarks').delete().eq('id', id);
    fetchBookmarks();
  }, [fetchBookmarks]);

  const isBookmarked = useCallback((version: string, abbrev: string, chapter: number, verse: number) => {
    return bookmarks.some(b => b.version === version && b.book_abbrev === abbrev && b.chapter === chapter && b.verse === verse);
  }, [bookmarks]);

  // Notes
  const fetchNotes = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('bible_notes').select('*').order('created_at', { ascending: false });
    if (data) setNotes(data as BibleNote[]);
  }, [user]);

  const addNote = useCallback(async (n: Omit<BibleNote, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;
    await supabase.from('bible_notes').insert({ ...n, user_id: user.id });
    fetchNotes();
  }, [user, fetchNotes]);

  const updateNote = useCallback(async (id: string, note: string) => {
    await supabase.from('bible_notes').update({ note }).eq('id', id);
    fetchNotes();
  }, [fetchNotes]);

  const deleteNote = useCallback(async (id: string) => {
    await supabase.from('bible_notes').delete().eq('id', id);
    fetchNotes();
  }, [fetchNotes]);

  // Highlights
  const fetchHighlights = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('bible_highlights').select('*').order('created_at', { ascending: false });
    if (data) setHighlights(data as BibleHighlight[]);
  }, [user]);

  const addHighlight = useCallback(async (h: { version: string; book_abbrev: string; chapter: number; verse: number; color: string }) => {
    if (!user) return;
    // Upsert: delete existing then insert
    await supabase.from('bible_highlights').delete()
      .eq('user_id', user.id).eq('version', h.version).eq('book_abbrev', h.book_abbrev)
      .eq('chapter', h.chapter).eq('verse', h.verse);
    await supabase.from('bible_highlights').insert({ ...h, user_id: user.id });
    fetchHighlights();
  }, [user, fetchHighlights]);

  const removeHighlight = useCallback(async (id: string) => {
    await supabase.from('bible_highlights').delete().eq('id', id);
    fetchHighlights();
  }, [fetchHighlights]);

  const getHighlight = useCallback((version: string, abbrev: string, chapter: number, verse: number) => {
    return highlights.find(h => h.version === version && h.book_abbrev === abbrev && h.chapter === chapter && h.verse === verse);
  }, [highlights]);

  useEffect(() => {
    fetchBooks('arc');
  }, [fetchBooks]);

  useEffect(() => {
    if (user) { fetchBookmarks(); fetchNotes(); fetchHighlights(); }
  }, [user, fetchBookmarks, fetchNotes, fetchHighlights]);

  // Realtime sync for bible data across devices
  useEffect(() => {
    if (!user) return;

    const bookmarksChannel = supabase
      .channel('bible-bookmarks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bible_bookmarks' }, () => {
        fetchBookmarks();
      })
      .subscribe();

    const highlightsChannel = supabase
      .channel('bible-highlights-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bible_highlights' }, () => {
        fetchHighlights();
      })
      .subscribe();

    const notesChannel = supabase
      .channel('bible-notes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bible_notes' }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(bookmarksChannel);
      supabase.removeChannel(highlightsChannel);
      supabase.removeChannel(notesChannel);
    };
  }, [user, fetchBookmarks, fetchHighlights, fetchNotes]);

  return {
    books, loadingBooks,
    verses, loadingVerses, currentBookInfo, fetchError,
    fetchChapter, fetchBooks,
    searchResults, loadingSearch, searchVerses,
    bookmarks, addBookmark, removeBookmark, isBookmarked,
    notes, addNote, updateNote, deleteNote,
    highlights, addHighlight, removeHighlight, getHighlight,
  };
}
