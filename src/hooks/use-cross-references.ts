import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface CrossReference {
  id: string;
  source_version: string;
  source_book_abbrev: string;
  source_book_name: string;
  source_chapter: number;
  source_verse: number;
  target_version: string;
  target_book_abbrev: string;
  target_book_name: string;
  target_chapter: number;
  target_verse: number;
  note: string;
  created_at: string;
}

export function useCrossReferences() {
  const { user } = useAuth();
  const [crossRefs, setCrossRefs] = useState<CrossReference[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCrossRefs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('bible_cross_references')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCrossRefs(data as CrossReference[]);
    setLoading(false);
  }, [user]);

  const addCrossRef = useCallback(async (ref: Omit<CrossReference, 'id' | 'created_at'>) => {
    if (!user) return;
    await supabase.from('bible_cross_references').insert({ ...ref, user_id: user.id });
    fetchCrossRefs();
  }, [user, fetchCrossRefs]);

  const deleteCrossRef = useCallback(async (id: string) => {
    await supabase.from('bible_cross_references').delete().eq('id', id);
    fetchCrossRefs();
  }, [fetchCrossRefs]);

  // Get cross-refs for a specific verse (both directions)
  const getRefsForVerse = useCallback((version: string, bookAbbrev: string, chapter: number, verse: number) => {
    return crossRefs.filter(r =>
      (r.source_version === version && r.source_book_abbrev === bookAbbrev && r.source_chapter === chapter && r.source_verse === verse) ||
      (r.target_version === version && r.target_book_abbrev === bookAbbrev && r.target_chapter === chapter && r.target_verse === verse)
    );
  }, [crossRefs]);

  useEffect(() => {
    if (user) fetchCrossRefs();
  }, [user, fetchCrossRefs]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('bible-crossrefs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bible_cross_references' }, () => {
        fetchCrossRefs();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchCrossRefs]);

  return { crossRefs, loading, addCrossRef, deleteCrossRef, getRefsForVerse };
}
