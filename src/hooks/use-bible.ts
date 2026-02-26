import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

const GITHUB_BASE = 'https://raw.githubusercontent.com/maatheusgois/bible/main/versions/pt-br';
const GETBIBLE_BASE = 'https://api.getbible.net/v2';

// Versions that use getBible API instead of MaatheusGois
const GETBIBLE_VERSIONS = new Set(['kjv', 'textusreceptus', 'aleppo']);

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
  { value: 'kjv', label: 'KJV - King James 1611' },
  { value: 'textusreceptus', label: 'Grego - Textus Receptus (NT)' },
  { value: 'aleppo', label: 'Hebraico - Aleppo Codex (AT)' },
];

// NT book IDs for testament detection (MaatheusGois format)
const NT_IDS = new Set(['mt', 'mc', 'lc', 'jo', 'at', 'rm', '1co', '2co', 'gl', 'ef', 'fp', 'cl', '1ts', '2ts', '1tm', '2tm', 'tt', 'fm', 'hb', 'tg', '1pe', '2pe', '1jo', '2jo', '3jo', 'jd', 'ap']);

interface RawBook {
  id: string;
  name: string;
  chapters: string[][];
}

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

  // Load MaatheusGois format bible
  const loadBible = useCallback(async (version: string): Promise<RawBook[]> => {
    if (bibleCache.current[version]) return bibleCache.current[version];
    const url = `${GITHUB_BASE}/${version}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${version}`);
    const data: RawBook[] = await res.json();
    bibleCache.current[version] = data;
    return data;
  }, []);

  // getBible book info from books.json
  interface GetBibleBookEntry {
    nr: number;
    name: string;
    url: string;
  }

  // getBible full book response (/{version}/{bookNr}.json)
  interface GetBibleFullBook {
    nr: number;
    name: string;
    chapters: { chapter: number; verses: { verse: number; text: string }[] }[];
  }

  // Cache getBible books list per version
  const getBibleBooksCache = useRef<Record<string, GetBibleBookEntry[]>>({});
  // Cache getBible full book data
  const getBibleBookDataCache = useRef<Record<string, GetBibleFullBook>>({});

  // Load getBible books list
  const loadGetBibleBooks = useCallback(async (version: string): Promise<GetBibleBookEntry[]> => {
    if (getBibleBooksCache.current[version]) return getBibleBooksCache.current[version];
    const url = `${GETBIBLE_BASE}/${version}/books.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load getBible books for ${version}`);
    const data: Record<string, GetBibleBookEntry> = await res.json();
    const booksList = Object.values(data).sort((a, b) => a.nr - b.nr);
    getBibleBooksCache.current[version] = booksList;
    return booksList;
  }, []);

  // Load getBible full book (all chapters)
  const loadGetBibleBook = useCallback(async (version: string, bookNr: number): Promise<GetBibleFullBook> => {
    const key = `${version}/${bookNr}`;
    if (getBibleBookDataCache.current[key]) return getBibleBookDataCache.current[key];
    const url = `${GETBIBLE_BASE}/${version}/${bookNr}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load book`);
    const data = await res.json();
    getBibleBookDataCache.current[key] = data;
    return data;
  }, []);

  // Load books list
  const fetchBooks = useCallback(async (version: string) => {
    setLoadingBooks(true);
    try {
      if (GETBIBLE_VERSIONS.has(version)) {
        const gbBooks = await loadGetBibleBooks(version);
        setBooks(gbBooks.map((b) => ({
          abbrev: String(b.nr),
          name: b.name,
          chapters: 0, // will be resolved when book is loaded
          testament: b.nr >= 40 ? 'NT' : 'VT',
        })));
        // Load chapter counts in background
        Promise.all(gbBooks.map(async (b) => {
          try {
            const fullBook = await loadGetBibleBook(version, b.nr);
            return { nr: b.nr, chapters: fullBook.chapters.length };
          } catch { return { nr: b.nr, chapters: 0 }; }
        })).then((counts) => {
          setBooks(prev => prev.map(book => {
            const count = counts.find(c => String(c.nr) === book.abbrev);
            return count ? { ...book, chapters: count.chapters } : book;
          }));
        });
      } else {
        const data = await loadBible(version);
        setBooks(data.map((b, index) => ({
          abbrev: b.id,
          name: b.name,
          chapters: b.chapters.length,
          testament: index < 39 ? 'VT' : 'NT',
        })));
      }
    } catch (err) {
      console.error('Error loading bible:', err);
    } finally {
      setLoadingBooks(false);
    }
  }, [loadBible, loadGetBibleBooks, loadGetBibleBook]);

  // Fetch chapter
  const fetchChapter = useCallback(async (version: string, abbrev: string, chapter: number) => {
    setLoadingVerses(true);
    setFetchError(null);
    try {
      if (GETBIBLE_VERSIONS.has(version)) {
        const bookNr = parseInt(abbrev, 10);
        const fullBook = await loadGetBibleBook(version, bookNr);
        const chapterData = fullBook.chapters.find(c => c.chapter === chapter);
        if (!chapterData) {
          setFetchError('Capítulo não encontrado'); setVerses([]); return;
        }
        setVerses(chapterData.verses.map(v => ({ number: v.verse, text: v.text.trim() })));
        setCurrentBookInfo({ name: fullBook.name });
        // Update chapter count if needed
        setBooks(prev => prev.map(b => b.abbrev === abbrev ? { ...b, chapters: fullBook.chapters.length } : b));
      } else {
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
      }
    } catch (err) {
      console.error('Error fetching chapter:', err);
      setFetchError('Erro ao carregar capítulo');
      setVerses([]);
    } finally {
      setLoadingVerses(false);
    }
  }, [loadBible, loadGetBibleBook]);

  // Search
  const searchVerses = useCallback(async (version: string, term: string) => {
    if (!term.trim()) return;
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      if (GETBIBLE_VERSIONS.has(version)) {
        const gbBooks = await loadGetBibleBooks(version);
        const lowerTerm = term.toLowerCase();
        const results: BibleSearchResult[] = [];
        for (const bookInfo of gbBooks) {
          if (results.length >= 50) break;
          try {
            const fullBook = await loadGetBibleBook(version, bookInfo.nr);
            for (const ch of fullBook.chapters) {
              for (const v of ch.verses) {
                if (v.text.toLowerCase().includes(lowerTerm)) {
                  results.push({
                    book_name: fullBook.name,
                    chapter: ch.chapter,
                    verse: v.verse,
                    text: v.text.trim(),
                  });
                  if (results.length >= 50) break;
                }
              }
              if (results.length >= 50) break;
            }
          } catch { /* skip failed book */ }
        }
        setSearchResults(results);
      } else {
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
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setLoadingSearch(false);
    }
  }, [loadBible, loadGetBibleBooks, loadGetBibleBook]);

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
