import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PDFDocument } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { uploadToR2, deleteFromR2, getR2PublicUrl } from '@/lib/r2';

interface DbDocument {
  id: string;
  title: string;
  author: string;
  date: string;
  file_name: string;
  file_size: number;
  pages: number | null;
  tags: string[];
  storage_path: string;
  created_at: string;
  updated_at: string;
  visibility: string;
}

// `favorite` isn't a column on `documents` — it lives in the per-user
// `document_favorites` join table, merged in by whoever calls this.
function toAppDoc(d: any, favoriteIds?: Set<string>): PDFDocument {
  return {
    id: d.id,
    title: d.title,
    author: d.author,
    date: d.date,
    fileName: d.file_name,
    fileSize: d.file_size,
    pages: d.pages ?? undefined,
    tags: d.tags,
    favorite: favoriteIds?.has(d.id) ?? false,
    createdAt: d.created_at,
    url: getR2PublicUrl(d.storage_path),
    visibility: d.visibility || 'personal',
    translator: d.translator || '',
  };
}

export function useDocuments() {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);

  const fetchFavoriteIds = useCallback(async (): Promise<Set<string>> => {
    if (!user) return new Set();
    const { data } = await supabase.from('document_favorites' as any).select('document_id');
    return new Set((data as any[] | null || []).map((r) => r.document_id));
  }, [user?.id]);

  const fetchDocuments = useCallback(async () => {
    if (!user) {
      setDocuments([]);
      setFavoriteIds(new Set());
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const favSet = await fetchFavoriteIds();
      setFavoriteIds(favSet);

      const batchSize = 1000;
      let offset = 0;
      let allData: any[] = [];
      let hasMore = true;

      while (hasMore) {
        // No .eq('user_id', ...) here — RLS already scopes this to "own documents
        // OR visibility = 'global'". Filtering by user_id here too would hide global
        // documents uploaded by other accounts, which defeats the point of "global".
        const { data, error } = await supabase
          .from('documents')
          .select('id, title, author, date, file_name, file_size, pages, tags, storage_path, created_at, updated_at, visibility, translator')
          .order('created_at', { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) {
          console.error('Erro ao buscar documentos:', error.message);
          setDocuments([]);
          return;
        }

        if (data && data.length > 0) {
          allData.push(...data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      setDocuments((allData as DbDocument[]).map((d) => toAppDoc(d, favSet)));
    } catch (err) {
      console.error('Erro inesperado ao buscar documentos:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchFavoriteIds]);

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
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT') {
            setDocuments((prev) => {
              if (prev.some((d) => d.id === newRecord.id)) return prev;
              return [toAppDoc(newRecord), ...prev].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            });
          } else if (eventType === 'UPDATE') {
            setDocuments((prev) => prev.map((doc) => (doc.id === newRecord.id ? toAppDoc(newRecord) : doc)));
          } else if (eventType === 'DELETE') {
            setDocuments((prev) => prev.filter((doc) => doc.id !== oldRecord.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchDocuments]);

  const uploadDocument = async (
    file: File,
    meta: { title: string; author: string; date: string; tags: string[]; visibility?: string; translator?: string }
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

    await uploadToR2(file, storagePath);

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
      translator: meta.translator || '',
    } as any);

    if (dbError) throw dbError;
  };

  const toggleFavorite = async (id: string) => {
    if (!user) return;
    const isFavorite = favoriteIds.has(id);

    if (isFavorite) {
      await supabase
        .from('document_favorites' as any)
        .delete()
        .eq('document_id', id)
        .eq('user_id', user.id);
    } else {
      await supabase
        .from('document_favorites' as any)
        .insert({ document_id: id, user_id: user.id } as any);
    }

    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (isFavorite) next.delete(id);
      else next.add(id);
      return next;
    });
    setDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, favorite: !isFavorite } : d))
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
      await deleteFromR2(data.storage_path);
    }

    await supabase.from('documents').delete().eq('id', id);
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const searchContent = async (
    term: string,
    searchType: 'exact' | 'proximity',
    filters?: { author?: string; translator?: string; tags?: string[]; startDate?: string; endDate?: string }
  ): Promise<(PDFDocument & { snippet?: string })[]> => {
    // Step 1: Query only IDs + metadata (no content) for speed
    let query = supabase
      .from('documents')
      .select('id, title, author, date, file_name, file_size, pages, tags, storage_path, created_at, updated_at, visibility, translator');

    if (filters?.author && filters.author !== 'all') {
      query = query.eq('author', filters.author);
    }
    if (filters?.translator && filters.translator !== 'all') {
      query = query.eq('translator', filters.translator);
    }
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, error } = await query.order('date', { ascending: false });
    if (error || !data) return [];

    let results = (data as any[]).map((d) => ({ ...toAppDoc(d, favoriteIds), snippet: undefined as string | undefined }));

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

    // Step 2: Fetch content for candidate docs, paginated with the same filters as
    // step 1 (rather than an `.in('id', [...hundreds of UUIDs...])` filter, which
    // builds a URL long enough to blow past proxy/client header-size limits and
    // makes the request fail silently — every search then returns zero results).
    const contentMap = new Map<string, string>();
    const PAGE_SIZE = 200;
    let offset = 0;
    while (true) {
      let contentQuery = supabase.from('documents').select('id, content');
      if (filters?.author && filters.author !== 'all') {
        contentQuery = contentQuery.eq('author', filters.author);
      }
      if (filters?.translator && filters.translator !== 'all') {
        contentQuery = contentQuery.eq('translator', filters.translator);
      }
      if (filters?.startDate) {
        contentQuery = contentQuery.gte('date', filters.startDate);
      }
      if (filters?.endDate) {
        contentQuery = contentQuery.lte('date', filters.endDate);
      }

      const { data: page, error: pageError } = await contentQuery
        .order('date', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (pageError || !page || page.length === 0) break;
      for (const row of page as any[]) {
        if (row.content) contentMap.set(row.id, row.content);
      }
      if (page.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }



    const expandedResults: typeof results = [];

    for (const doc of results) {
      const content = contentMap.get(doc.id);
      if (!content) continue;

      const contentNorm = normalizeText(content);

      if (searchType === 'exact') {
        // Match the exact phrase as typed (normalized), not individual words
        const exactNorm = normalizeText(term);
        const termRegex = new RegExp(escapeRegex(exactNorm), 'gi');
        let match: RegExpExecArray | null;

        while ((match = termRegex.exec(contentNorm)) !== null) {
          const idx = match.index;
          const matchLen = match[0].length;
          const snippetRadius = Math.floor((300 - matchLen) / 2);
          const start = Math.max(0, idx - Math.max(snippetRadius, 0));
          const end = Math.min(contentNorm.length, idx + matchLen + Math.max(snippetRadius, 0));
          const before = start > 0 ? '...' : '';
          const after = end < contentNorm.length ? '...' : '';
          expandedResults.push({ ...doc, snippet: before + contentNorm.slice(start, end) + after });
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

          const start = Math.max(0, pos.index - 100);
          const end = Math.min(contentNorm.length, start + 300);
          const before = start > 0 ? '...' : '';
          const after = end < contentNorm.length ? '...' : '';
          expandedResults.push({ ...doc, snippet: before + contentNorm.slice(start, end) + after });
        }
      }
    }

    return expandedResults;
  };

  return { documents, loading, fetchDocuments, uploadDocument, toggleFavorite, deleteDocument, updateDocument, searchContent };
}
