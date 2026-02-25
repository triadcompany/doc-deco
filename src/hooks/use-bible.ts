import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

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

export const BIBLE_VERSIONS = [
  { value: 'almeida', label: 'Almeida - João Ferreira de Almeida' },
];

// Static list of Bible books
const BIBLE_BOOKS: BibleBook[] = [
  { abbrev: 'gn', name: 'Gênesis', chapters: 50, testament: 'VT' },
  { abbrev: 'ex', name: 'Êxodo', chapters: 40, testament: 'VT' },
  { abbrev: 'lv', name: 'Levítico', chapters: 27, testament: 'VT' },
  { abbrev: 'nm', name: 'Números', chapters: 36, testament: 'VT' },
  { abbrev: 'dt', name: 'Deuteronômio', chapters: 34, testament: 'VT' },
  { abbrev: 'js', name: 'Josué', chapters: 24, testament: 'VT' },
  { abbrev: 'jz', name: 'Juízes', chapters: 21, testament: 'VT' },
  { abbrev: 'rt', name: 'Rute', chapters: 4, testament: 'VT' },
  { abbrev: '1sm', name: '1 Samuel', chapters: 31, testament: 'VT' },
  { abbrev: '2sm', name: '2 Samuel', chapters: 24, testament: 'VT' },
  { abbrev: '1rs', name: '1 Reis', chapters: 22, testament: 'VT' },
  { abbrev: '2rs', name: '2 Reis', chapters: 25, testament: 'VT' },
  { abbrev: '1cr', name: '1 Crônicas', chapters: 29, testament: 'VT' },
  { abbrev: '2cr', name: '2 Crônicas', chapters: 36, testament: 'VT' },
  { abbrev: 'ed', name: 'Esdras', chapters: 10, testament: 'VT' },
  { abbrev: 'ne', name: 'Neemias', chapters: 13, testament: 'VT' },
  { abbrev: 'et', name: 'Ester', chapters: 10, testament: 'VT' },
  { abbrev: 'job', name: 'Jó', chapters: 42, testament: 'VT' },
  { abbrev: 'sl', name: 'Salmos', chapters: 150, testament: 'VT' },
  { abbrev: 'pv', name: 'Provérbios', chapters: 31, testament: 'VT' },
  { abbrev: 'ec', name: 'Eclesiastes', chapters: 12, testament: 'VT' },
  { abbrev: 'ct', name: 'Cânticos', chapters: 8, testament: 'VT' },
  { abbrev: 'is', name: 'Isaías', chapters: 66, testament: 'VT' },
  { abbrev: 'jr', name: 'Jeremias', chapters: 52, testament: 'VT' },
  { abbrev: 'lm', name: 'Lamentações', chapters: 5, testament: 'VT' },
  { abbrev: 'ez', name: 'Ezequiel', chapters: 48, testament: 'VT' },
  { abbrev: 'dn', name: 'Daniel', chapters: 12, testament: 'VT' },
  { abbrev: 'os', name: 'Oséias', chapters: 14, testament: 'VT' },
  { abbrev: 'jl', name: 'Joel', chapters: 3, testament: 'VT' },
  { abbrev: 'am', name: 'Amós', chapters: 9, testament: 'VT' },
  { abbrev: 'ob', name: 'Obadias', chapters: 1, testament: 'VT' },
  { abbrev: 'jn', name: 'Jonas', chapters: 4, testament: 'VT' },
  { abbrev: 'mq', name: 'Miquéias', chapters: 7, testament: 'VT' },
  { abbrev: 'na', name: 'Naum', chapters: 3, testament: 'VT' },
  { abbrev: 'hc', name: 'Habacuque', chapters: 3, testament: 'VT' },
  { abbrev: 'sf', name: 'Sofonias', chapters: 3, testament: 'VT' },
  { abbrev: 'ag', name: 'Ageu', chapters: 2, testament: 'VT' },
  { abbrev: 'zc', name: 'Zacarias', chapters: 14, testament: 'VT' },
  { abbrev: 'ml', name: 'Malaquias', chapters: 4, testament: 'VT' },
  { abbrev: 'mt', name: 'Mateus', chapters: 28, testament: 'NT' },
  { abbrev: 'mc', name: 'Marcos', chapters: 16, testament: 'NT' },
  { abbrev: 'lc', name: 'Lucas', chapters: 24, testament: 'NT' },
  { abbrev: 'jo', name: 'João', chapters: 21, testament: 'NT' },
  { abbrev: 'at', name: 'Atos', chapters: 28, testament: 'NT' },
  { abbrev: 'rm', name: 'Romanos', chapters: 16, testament: 'NT' },
  { abbrev: '1co', name: '1 Coríntios', chapters: 16, testament: 'NT' },
  { abbrev: '2co', name: '2 Coríntios', chapters: 13, testament: 'NT' },
  { abbrev: 'gl', name: 'Gálatas', chapters: 6, testament: 'NT' },
  { abbrev: 'ef', name: 'Efésios', chapters: 6, testament: 'NT' },
  { abbrev: 'fp', name: 'Filipenses', chapters: 4, testament: 'NT' },
  { abbrev: 'cl', name: 'Colossenses', chapters: 4, testament: 'NT' },
  { abbrev: '1ts', name: '1 Tessalonicenses', chapters: 5, testament: 'NT' },
  { abbrev: '2ts', name: '2 Tessalonicenses', chapters: 3, testament: 'NT' },
  { abbrev: '1tm', name: '1 Timóteo', chapters: 6, testament: 'NT' },
  { abbrev: '2tm', name: '2 Timóteo', chapters: 4, testament: 'NT' },
  { abbrev: 'tt', name: 'Tito', chapters: 3, testament: 'NT' },
  { abbrev: 'fm', name: 'Filemom', chapters: 1, testament: 'NT' },
  { abbrev: 'hb', name: 'Hebreus', chapters: 13, testament: 'NT' },
  { abbrev: 'tg', name: 'Tiago', chapters: 5, testament: 'NT' },
  { abbrev: '1pe', name: '1 Pedro', chapters: 5, testament: 'NT' },
  { abbrev: '2pe', name: '2 Pedro', chapters: 3, testament: 'NT' },
  { abbrev: '1jo', name: '1 João', chapters: 5, testament: 'NT' },
  { abbrev: '2jo', name: '2 João', chapters: 1, testament: 'NT' },
  { abbrev: '3jo', name: '3 João', chapters: 1, testament: 'NT' },
  { abbrev: 'jd', name: 'Judas', chapters: 1, testament: 'NT' },
  { abbrev: 'ap', name: 'Apocalipse', chapters: 22, testament: 'NT' },
];

// Mapping from our abbrev to bible-api.com book names
const BOOK_API_NAMES: Record<string, string> = {
  gn: 'genesis', ex: 'exodus', lv: 'leviticus', nm: 'numbers', dt: 'deuteronomy',
  js: 'joshua', jz: 'judges', rt: 'ruth', '1sm': '1samuel', '2sm': '2samuel',
  '1rs': '1kings', '2rs': '2kings', '1cr': '1chronicles', '2cr': '2chronicles',
  ed: 'ezra', ne: 'nehemiah', et: 'esther', job: 'job', sl: 'psalms',
  pv: 'proverbs', ec: 'ecclesiastes', ct: 'songofsolomon', is: 'isaiah',
  jr: 'jeremiah', lm: 'lamentations', ez: 'ezekiel', dn: 'daniel',
  os: 'hosea', jl: 'joel', am: 'amos', ob: 'obadiah', jn: 'jonah',
  mq: 'micah', na: 'nahum', hc: 'habakkuk', sf: 'zephaniah', ag: 'haggai',
  zc: 'zechariah', ml: 'malachi',
  mt: 'matthew', mc: 'mark', lc: 'luke', jo: 'john', at: 'acts',
  rm: 'romans', '1co': '1corinthians', '2co': '2corinthians', gl: 'galatians',
  ef: 'ephesians', fp: 'philippians', cl: 'colossians', '1ts': '1thessalonians',
  '2ts': '2thessalonians', '1tm': '1timothy', '2tm': '2timothy', tt: 'titus',
  fm: 'philemon', hb: 'hebrews', tg: 'james', '1pe': '1peter', '2pe': '2peter',
  '1jo': '1john', '2jo': '2john', '3jo': '3john', jd: 'jude', ap: 'revelation',
};

export function useBible() {
  const { user } = useAuth();
  const [books] = useState<BibleBook[]>(BIBLE_BOOKS);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [searchResults, setSearchResults] = useState<BibleSearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [bookmarks, setBookmarks] = useState<BibleBookmark[]>([]);
  const [notes, setNotes] = useState<BibleNote[]>([]);
  const [currentBookInfo, setCurrentBookInfo] = useState<{ name: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch chapter verses from bible-api.com
  const fetchChapter = useCallback(async (version: string, abbrev: string, chapter: number) => {
    setLoadingVerses(true);
    setFetchError(null);
    const book = BIBLE_BOOKS.find(b => b.abbrev === abbrev);
    const apiName = BOOK_API_NAMES[abbrev];
    if (!apiName || !book) {
      setLoadingVerses(false);
      setFetchError('Livro não encontrado');
      return;
    }
    try {
      // bible-api.com format: book+chapter?translation=almeida
      const url = `https://bible-api.com/${apiName}+${chapter}?translation=${version}`;
      const res = await fetch(url);
      const text = await res.text();

      if (!res.ok) {
        console.error('Bible API error:', res.status, text.substring(0, 200));
        setFetchError(`Erro ao carregar: ${res.status}`);
        setVerses([]);
        setLoadingVerses(false);
        return;
      }

      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.error('Invalid JSON from Bible API:', text.substring(0, 200));
        setFetchError('Resposta inválida da API');
        setVerses([]);
        setLoadingVerses(false);
        return;
      }

      if (data.verses && Array.isArray(data.verses)) {
        setVerses(data.verses.map((v: any) => ({
          number: v.verse,
          text: v.text?.trim() || '',
        })));
        setCurrentBookInfo({ name: book.name });
      } else {
        setVerses([]);
        setFetchError('Formato de resposta inesperado');
      }
    } catch (err) {
      console.error('Error fetching chapter:', err);
      setFetchError('Erro de conexão com a API');
      setVerses([]);
    } finally {
      setLoadingVerses(false);
    }
  }, []);

  // Search - bible-api.com doesn't have search, so we search locally within fetched content
  const searchVerses = useCallback(async (version: string, term: string) => {
    if (!term.trim()) return;
    setLoadingSearch(true);
    setSearchResults([]);
    const results: BibleSearchResult[] = [];
    const lowerTerm = term.toLowerCase();

    // Search through a few popular books for demo (full search would need a different API)
    const booksToSearch = ['jo', 'sl', 'gn', 'mt', 'rm', 'pv', '1co', 'is', 'ap', 'at'];
    
    try {
      for (const abbrev of booksToSearch) {
        const apiName = BOOK_API_NAMES[abbrev];
        const book = BIBLE_BOOKS.find(b => b.abbrev === abbrev);
        if (!apiName || !book) continue;

        // Search first 5 chapters of each book
        for (let ch = 1; ch <= Math.min(5, book.chapters); ch++) {
          try {
            const res = await fetch(`https://bible-api.com/${apiName}+${ch}?translation=${version}`);
            if (!res.ok) continue;
            const data = await res.json();
            if (data.verses) {
              for (const v of data.verses) {
                if (v.text && v.text.toLowerCase().includes(lowerTerm)) {
                  results.push({
                    book_name: book.name,
                    chapter: ch,
                    verse: v.verse,
                    text: v.text.trim(),
                  });
                }
              }
            }
          } catch { /* skip failed chapters */ }
          if (results.length >= 20) break;
        }
        if (results.length >= 20) break;
      }
    } catch (err) {
      console.error('Search error:', err);
    }

    setSearchResults(results);
    setLoadingSearch(false);
  }, []);

  // Bookmarks
  const fetchBookmarks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bible_bookmarks')
      .select('*')
      .order('created_at', { ascending: false });
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
    const { data } = await supabase
      .from('bible_notes')
      .select('*')
      .order('created_at', { ascending: false });
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

  useEffect(() => {
    if (user) {
      fetchBookmarks();
      fetchNotes();
    }
  }, [user, fetchBookmarks, fetchNotes]);

  return {
    books, loadingBooks: false,
    verses, loadingVerses, currentBookInfo, fetchError,
    fetchChapter,
    searchResults, loadingSearch, searchVerses,
    bookmarks, addBookmark, removeBookmark, isBookmarked,
    notes, addNote, updateNote, deleteNote,
  };
}
