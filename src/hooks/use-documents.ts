import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PDFDocument } from '@/lib/types';

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
}

function toAppDoc(d: DbDocument): PDFDocument {
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
  };
}

export function useDocuments() {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments((data as DbDocument[]).map(toAppDoc));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const uploadDocument = async (
    file: File,
    meta: { title: string; author: string; date: string; tags: string[] }
  ) => {
    const safeName = file.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${Date.now()}-${safeName}`;

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

  return { documents, loading, fetchDocuments, uploadDocument, toggleFavorite, deleteDocument };
}
