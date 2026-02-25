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
    setLoading(true);

    const { data, error } = await supabase
      .from('documents')
      .select('id, title, author, date, file_name, file_size, pages, tags, favorite, storage_path, created_at, updated_at, visibility')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar documentos:', error.message);
      setDocuments([]);
      setLoading(false);
      return;
    }

    setDocuments((data as DbDocument[]).map(toAppDoc));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchDocuments();
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
    let query = supabase.from('documents').select('id, title, author, date, file_name, file_size, pages, tags, favorite, storage_path, created_at, updated_at, visibility');

    if (term) {
      if (searchType === 'exact') {
        query = query.ilike('content', `%${term}%`);
      } else {
        const words = term.split(/\s+/).filter(Boolean);
        for (const word of words) {
          query = query.ilike('content', `%${word}%`);
        }
      }
    }

    if (filters?.author && filters.author !== 'all') {
      query = query.eq('author', filters.author);
    }
    if (filters?.startDate) {
      query = query.gte('date', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('date', filters.endDate);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error || !data) return [];

    let results = (data as any[]).map((d) => ({ ...toAppDoc(d), snippet: undefined as string | undefined }));

    if (filters?.tags && filters.tags.length > 0) {
      results = results.filter((d) =>
        filters.tags!.some((st) => d.tags.some((t: string) => t.toLowerCase().includes(st)))
      );
    }

    // Step 2: Fetch snippets only for the first 50 results (content field is heavy)
    if (term && results.length > 0) {
      const idsToSnippet = results.slice(0, 50).map((r) => r.id);
      const { data: contentData } = await supabase
        .from('documents')
        .select('id, content')
        .in('id', idsToSnippet);

      if (contentData) {
        const contentMap = new Map<string, string>();
        for (const row of contentData as any[]) {
          if (row.content) contentMap.set(row.id, row.content);
        }

        const lowerTerm = term.toLowerCase();
        results = results.map((doc) => {
          const content = contentMap.get(doc.id);
          if (!content) return doc;
          const idx = content.toLowerCase().indexOf(lowerTerm);
          if (idx === -1) return doc;
          const start = Math.max(0, idx - 150);
          const end = Math.min(content.length, idx + lowerTerm.length + 150);
          const before = start > 0 ? '...' : '';
          const after = end < content.length ? '...' : '';
          return { ...doc, snippet: before + content.slice(start, end) + after };
        });
      }
    }

    return results;
  };

  return { documents, loading, fetchDocuments, uploadDocument, toggleFavorite, deleteDocument, updateDocument, searchContent };
}
