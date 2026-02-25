import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PDFDocument } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

interface DbDocument {
  id: string;
  title: string;
  author: string;
  date: string;
  file_name: string;
  file_size: number;
  pages: number | null;
  tags: string[];
  favorite: boolean;
  storage_path: string;
  created_at: string;
  updated_at: string;
  visibility: string;
}

function toAppDoc(d: any): PDFDocument {
  const { data } = supabase.storage.from('pdfs').getPublicUrl(d.storage_path);
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    date: d.date,
    fileName: d.file_name,
    fileSize: d.file_size,
    pages: d.pages ?? undefined,
    tags: d.tags,
    favorite: d.favorite,
    createdAt: d.created_at,
    url: data.publicUrl,
    visibility: d.visibility || 'personal',
  };
}

export function useDocuments() {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('documents')
        .select('id, title, author, date, file_name, file_size, pages, tags, favorite, storage_path, created_at, updated_at, visibility')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar documentos:', error.message);
        setDocuments([]);
        return;
      }

      setDocuments((data as DbDocument[]).map(toAppDoc));
    } catch (err) {
      console.error('Erro inesperado ao buscar documentos:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Realtime sync: refetch documents when changes happen on any device
  useEffect(() => {
    const channel = supabase
      .channel('documents-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'documents' },
        () => {
          fetchDocuments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDocuments]);

  const uploadDocument = async (
    file: File,
    meta: { title: string; author: string; date: string; tags: string[]; visibility?: string }
  ) => {
    const { extractTextFromPDF } = await import('@/lib/pdf-text-extract');

    const safeName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${Date.now()}-${safeName}`;

    // Extract text content from PDF
    let content = '';
    try {
      content = await extractTextFromPDF(file);
      // Remove null bytes and unsupported Unicode escape sequences that PostgreSQL rejects
      content = content.replace(/\u0000/g, '').replace(/\\u0000/g, '');
    } catch (e) {
      console.warn('Could not extract text from PDF:', e);
    }

    const { error: storageError } = await supabase.storage
      .from('pdfs')
      .upload(storagePath, file, { contentType: 'application/pdf' });

    if (storageError) throw storageError;

    const { error: dbError } = await supabase.from('documents').insert({
      title: meta.title,
      author: meta.author,
      date: meta.date,
      file_name: file.name,
      file_size: file.size,
      tags: meta.tags,
      storage_path: storagePath,
      content,
      user_id: user?.id,
      visibility: meta.visibility || 'personal',
    } as any);

    if (dbError) throw dbError;
  };

  const toggleFavorite = async (id: string) => {
    const doc = documents.find((d) => d.id === id);
    if (!doc) return;

    await supabase
      .from('documents')
      .update({ favorite: !doc.favorite } as any)
      .eq('id', id);

    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d))
    );
  };

  const updateDocument = async (
    id: string,
    data: { title: string; author: string; date: string; tags: string[]; visibility?: string }
  ) => {
    const { error } = await supabase
      .from('documents')
      .update({
        title: data.title,
        author: data.author,
        date: data.date,
        tags: data.tags,
        visibility: data.visibility || 'personal',
      } as any)
      .eq('id', id);

    if (error) throw error;

    setDocuments((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, title: data.title, author: data.author, date: data.date, tags: data.tags, visibility: (data.visibility as any) || 'personal' } : d
      )
    );
  };

  const deleteDocument = async (id: string) => {
    const { data } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('id', id)
      .maybeSingle();

    if (data) {
      await supabase.storage.from('pdfs').remove([(data as any).storage_path]);
    }

    await supabase.from('documents').delete().eq('id', id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const searchContent = async (
    term: string,
    searchType: 'exact' | 'proximity',
    filters?: { author?: string; tags?: string[]; startDate?: string; endDate?: string }
  ): Promise<(PDFDocument & { snippet?: string })[]> => {
    // Step 1: Query only IDs + metadata (no content) for speed
    let query = supabase
      .from('documents')
      .select('id, title, author, date, file_name, file_size, pages, tags, favorite, storage_path, created_at, updated_at, visibility');

    if (filters?.author && filters.author !== 'all') {
      query = query.eq('author', filters.author);
    }
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, error } = await query.order('date', { ascending: false });
    if (error || !data) return [];

    let results = (data as any[]).map((d) => ({ ...toAppDoc(d), snippet: undefined as string | undefined }));

    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter((d) =>
        filters.tags!.some((st) => d.tags.some((t: string) => t.toLowerCase().includes(st)))
      );
    }

    if (!term.trim() || results.length === 0) {
      return results;
    }

    const normalizeText = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const termWords = normalizeText(term).split(/\s+/).filter(Boolean);
    if (termWords.length === 0) return results;

    // Step 2: Fetch content for candidate docs and filter with accent-insensitive matching
    const idsToSnippet = results.map((r) => r.id);
    const { data: contentData, error: contentError } = await supabase
      .from('documents')
      .select('id, content')
      .in('id', idsToSnippet);

    if (contentError || !contentData) return [];

    const contentMap = new Map<string, string>();
    for (const row of contentData as any[]) {
      if (row.content) contentMap.set(row.id, row.content);
    }

    const expandedResults: typeof results = [];

    for (const doc of results) {
      const content = contentMap.get(doc.id);
      if (!content) continue;

      const contentNorm = normalizeText(content);

      if (searchType === 'exact') {
        const regexPattern = termWords.map(escapeRegex).join('\\s+');
        const termRegex = new RegExp(regexPattern, 'gi');
        let match: RegExpExecArray | null;

        while ((match = termRegex.exec(contentNorm)) !== null) {
          const idx = match.index;
          const matchLen = match[0].length;
          const start = Math.max(0, idx - 300);
          const end = Math.min(content.length, idx + matchLen + 300);
          const before = start > 0 ? '...' : '';
          const after = end < content.length ? '...' : '';
          expandedResults.push({ ...doc, snippet: before + content.slice(start, end) + after });
        }
      } else {
        const wordPositions: { word: string; index: number }[] = [];

        for (const w of termWords) {
          const wRegex = new RegExp(escapeRegex(w), 'gi');
          let m: RegExpExecArray | null;
          while ((m = wRegex.exec(contentNorm)) !== null) {
            wordPositions.push({ word: w, index: m.index });
          }
        }

        const firstWordPositions = wordPositions.filter((p) => p.word === termWords[0]);
        const addedSnippets = new Set<number>();

        for (const pos of firstWordPositions) {
          const rangeStart = pos.index - 300;
          const rangeEnd = pos.index + 300;
          const allFound = termWords.every((w) =>
            wordPositions.some((p) => p.word === w && p.index >= rangeStart && p.index <= rangeEnd)
          );

          if (!allFound) continue;

          const snipKey = Math.round(pos.index / 50);
          if (addedSnippets.has(snipKey)) continue;
          addedSnippets.add(snipKey);

          const start = Math.max(0, pos.index - 300);
          const end = Math.min(content.length, pos.index + termWords[0].length + 300);
          const before = start > 0 ? '...' : '';
          const after = end < content.length ? '...' : '';
          expandedResults.push({ ...doc, snippet: before + content.slice(start, end) + after });
        }
      }
    }

    return expandedResults;
  };

  return { documents, loading, fetchDocuments, uploadDocument, toggleFavorite, deleteDocument, updateDocument, searchContent };
}
