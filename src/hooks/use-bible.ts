import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

const API_BASE = 'https://www.abibliadigital.com.br/api';

export interface BibleBook {
  abbrev: { pt: string; en: string };
  name: string;
  author: string;
  group: string;
  chapters: number;
  testament: string;
}

export interface BibleVerse {
  number: number;
  text: string;
}

export interface BibleChapterResult {
  book: { abbrev: { pt: string }; name: string; author: string };
  chapter: { number: number; verses: number };
  verses: BibleVerse[];
}

export interface BibleSearchResult {
  book: { abbrev: { pt: string }; name: string };
  chapter: number;
  number: number;
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
  { value: 'nvi', label: 'NVI - Nova Versão Internacional' },
  { value: 'acf', label: 'ACF - Almeida Corrigida Fiel' },
  { value: 'ra', label: 'RA - Almeida Revista e Atualizada' },
];

export function useBible() {
  const { user } = useAuth();
  const [books, setBooks] = useState<BibleBook[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(false);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [searchResults, setSearchResults] = useState<BibleSearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [bookmarks, setBookmarks] = useState<BibleBookmark[]>([]);
  const [notes, setNotes] = useState<BibleNote[]>([]);
  const [currentBookInfo, setCurrentBookInfo] = useState<{ name: string; author: string } | null>(null);

  // Fetch all books
  const fetchBooks = useCallback(async () => {
    setLoadingBooks(true);
    try {
      const res = await fetch(`${API_BASE}/books`);
      if (!res.ok) throw new Error('Failed to fetch books');
      const data = await res.json();
      setBooks(data);
    } catch (err) {
      console.error('Error fetching books:', err);
    } finally {
      setLoadingBooks(false);
    }
  }, []);

  // Fetch chapter verses
  const fetchChapter = useCallback(async (version: string, abbrev: string, chapter: number) => {
    setLoadingVerses(true);
    try {
      const res = await fetch(`${API_BASE}/verses/${version}/${abbrev}/${chapter}`);
      if (!res.ok) throw new Error('Failed to fetch chapter');
      const data: BibleChapterResult = await res.json();
      setVerses(data.verses);
      setCurrentBookInfo({ name: data.book.name, author: data.book.author });
    } catch (err) {
      console.error('Error fetching chapter:', err);
      setVerses([]);
    } finally {
      setLoadingVerses(false);
    }
  }, []);

  // Search verses
  const searchVerses = useCallback(async (version: string, term: string) => {
    if (!term.trim()) return;
    setLoadingSearch(true);
    setSearchResults([]);
    try {
      const res = await fetch(`${API_BASE}/verses/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version, search: term }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(data.verses || []);
    } catch (err) {
      console.error('Error searching:', err);
      setSearchResults([]);
    } finally {
      setLoadingSearch(false);
    }
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
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    if (user) {
      fetchBookmarks();
      fetchNotes();
    }
  }, [user, fetchBookmarks, fetchNotes]);

  return {
    books, loadingBooks,
    verses, loadingVerses, currentBookInfo,
    fetchChapter,
    searchResults, loadingSearch, searchVerses,
    bookmarks, addBookmark, removeBookmark, isBookmarked,
    notes, addNote, updateNote, deleteNote,
  };
}
