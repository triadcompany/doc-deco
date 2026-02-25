import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface DocSummary {
  id: string;
  documentId: string;
  summary: string;
  createdAt: string;
  updatedAt: string;
}

function toApp(row: any): DocSummary {
  return {
    id: row.id,
    documentId: row.document_id,
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

  const upsertSummary = useCallback(async (documentId: string, summary: string) => {
    if (!user?.id) return;

    const existing = summaries.find((s) => s.documentId === documentId);
    if (existing) {
      const { error } = await supabase
        .from('document_summaries')
        .update({ summary } as any)
        .eq('id', existing.id);
      if (error) console.error('Error updating summary:', error);
    } else {
      const { error } = await supabase
        .from('document_summaries')
        .insert({ document_id: documentId, user_id: user.id, summary } as any);
      if (error) console.error('Error inserting summary:', error);
    }
    await fetchSummaries();
  }, [user?.id, summaries, fetchSummaries]);

  const deleteSummary = useCallback(async (id: string) => {
    const { error } = await supabase.from('document_summaries').delete().eq('id', id);
    if (error) console.error('Error deleting summary:', error);
    setSummaries((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { summaries, loading, upsertSummary, deleteSummary, refetch: fetchSummaries };
}
