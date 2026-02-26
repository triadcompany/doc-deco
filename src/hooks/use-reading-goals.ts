import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface ReadingGoal {
  id: string;
  month: number;
  year: number;
  monthly_docs_goal: number;
  daily_pages_goal: number;
}

export interface ReadingProgressItem {
  id: string;
  document_id: string;
  current_page: number;
  is_reading: boolean;
  completed: boolean;
  started_at: string;
  completed_at: string | null;
}

export function useReadingGoals() {
  const { user } = useAuth();
  const [goal, setGoal] = useState<ReadingGoal | null>(null);
  const [progress, setProgress] = useState<ReadingProgressItem[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const fetchGoal = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reading_goals')
        .select('*')
        .eq('month', currentMonth)
        .eq('year', currentYear)
        .maybeSingle();
      if (error) {
        console.error('Erro ao buscar meta:', error.message);
        return;
      }
      setGoal(data as ReadingGoal | null);
    } catch (err) {
      console.error('Erro inesperado ao buscar meta:', err);
    }
  }, [user, currentMonth, currentYear]);

  const fetchProgress = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('reading_progress')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) {
        console.error('Erro ao buscar progresso:', error.message);
        return;
      }
      const rows = (data as ReadingProgressItem[] | null) ?? [];
      const latestByDocument = new Map<string, ReadingProgressItem>();
      for (const item of rows) {
        if (!latestByDocument.has(item.document_id)) {
          latestByDocument.set(item.document_id, item);
        }
      }
      setProgress(Array.from(latestByDocument.values()));
    } catch (err) {
      console.error('Erro inesperado ao buscar progresso:', err);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchGoal(), fetchProgress()]).finally(() => setLoading(false));
  }, [fetchGoal, fetchProgress]);

  // Realtime sync for reading progress and goals
  useEffect(() => {
    const progressChannel = supabase
      .channel('reading-progress-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reading_progress' }, () => {
        fetchProgress();
      })
      .subscribe();

    const goalsChannel = supabase
      .channel('reading-goals-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reading_goals' }, () => {
        fetchGoal();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(progressChannel);
      supabase.removeChannel(goalsChannel);
    };
  }, [fetchGoal, fetchProgress]);

  const upsertGoal = async (monthlyDocs: number, dailyPages: number) => {
    if (!user) return;
    if (goal) {
      await supabase
        .from('reading_goals')
        .update({ monthly_docs_goal: monthlyDocs, daily_pages_goal: dailyPages } as any)
        .eq('id', goal.id);
    } else {
      await supabase.from('reading_goals').insert({
        user_id: user.id,
        month: currentMonth,
        year: currentYear,
        monthly_docs_goal: monthlyDocs,
        daily_pages_goal: dailyPages,
      } as any);
    }
    await fetchGoal();
  };

  const startReading = async (documentId: string) => {
    if (!user) return;
    const existing = progress.find((p) => p.document_id === documentId);
    if (existing) {
      await supabase
        .from('reading_progress')
        .update({ is_reading: true, completed: false } as any)
        .eq('id', existing.id);
    } else {
      await supabase.from('reading_progress').insert({
        user_id: user.id,
        document_id: documentId,
        current_page: 0,
        is_reading: true,
      } as any);
    }
    await fetchProgress();
  };

  const updateProgress = async (documentId: string, currentPage: number) => {
    if (!user) return;
    await supabase
      .from('reading_progress')
      .update({ current_page: currentPage } as any)
      .eq('document_id', documentId)
      .eq('user_id', user.id);
    await fetchProgress();
  };

  const markCompleted = async (documentId: string) => {
    if (!user) return;
    await supabase
      .from('reading_progress')
      .update({ completed: true, is_reading: false, completed_at: new Date().toISOString() } as any)
      .eq('document_id', documentId)
      .eq('user_id', user.id);
    await fetchProgress();
  };

  const removeReading = async (documentId: string) => {
    if (!user) return;
    await supabase
      .from('reading_progress')
      .delete()
      .eq('document_id', documentId)
      .eq('user_id', user.id);
    await fetchProgress();
  };

  const completedThisMonth = progress.filter((p) => {
    if (!p.completed || !p.completed_at) return false;
    const d = new Date(p.completed_at);
    return d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const currentReadings = progress.filter((p) => p.is_reading && !p.completed);

  return {
    goal,
    progress,
    currentReadings,
    completedThisMonth,
    loading,
    upsertGoal,
    startReading,
    updateProgress,
    markCompleted,
    removeReading,
    fetchProgress,
  };
}
