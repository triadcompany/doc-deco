import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface DocSummary {
  id: string;
  title: string;
  documentId: string | null;
  documentIds: string[];
  summary: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

function toApp(row: any): DocSummary {
  const docIds: string[] = row.document_ids?.length
    ? row.document_ids
    : row.document_id
      ? [row.document_id]
      : [];
  return {
    id: row.id,
    title: row.title || '',
    documentId: row.document_id || null,
    documentIds: docIds,
    summary: row.summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useDocumentSummaries() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<DocSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSummaries = useCallback(async () => {
    if (!user?.id) {
      setSummaries([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('document_summaries')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error fetching summaries:', error);
      setSummaries([]);
    } else {
      setSummaries((data as any[]).map(toApp));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const upsertSummary = useCallback(async (
    id: string | null,
    title: string,
    documentIds: string[],
    summary: string,
  ) => {
    if (!user?.id) return;

    const primaryDocId = documentIds.length > 0 ? documentIds[0] : null;
    const payload: any = {
      title,
      summary,
      document_ids: documentIds,
      ...(primaryDocId ? { document_id: primaryDocId } : {}),
    };

    if (id) {
      const { error } = await supabase
        .from('document_summaries')
        .update(payload)
        .eq('id', id);
      if (error) console.error('Error updating summary:', error);
    } else {
      const { error } = await supabase
        .from('document_summaries')
        .insert({ ...payload, user_id: user.id } as any);
      if (error) console.error('Error inserting summary:', error);
    }
    await fetchSummaries();
  }, [user?.id, fetchSummaries]);

  const deleteSummary = useCallback(async (id: string) => {
    const { error } = await supabase.from('document_summaries').delete().eq('id', id);
    if (error) console.error('Error deleting summary:', error);
    setSummaries((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { summaries, loading, upsertSummary, deleteSummary, refetch: fetchSummaries };
}
