import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface StudyFolder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useStudyFolders() {
  const { user } = useAuth();
  const [folders, setFolders] = useState<StudyFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFolders = useCallback(async () => {
    if (!user?.id) { setFolders([]); setLoading(false); return; }
    const { data, error } = await (supabase as any)
      .from('study_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('name');

    if (error) { console.error('Error fetching folders:', error); setFolders([]); }
    else {
      setFolders((data as any[]).map((r: any) => ({
        id: r.id,
        name: r.name,
        parentId: r.parent_id || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    if (!user?.id) return;
    const payload: any = { name, user_id: user.id };
    if (parentId) payload.parent_id = parentId;
    const { error } = await (supabase as any).from('study_folders').insert(payload);
    if (error) console.error('Error creating folder:', error);
    await fetchFolders();
  }, [user?.id, fetchFolders]);

  const renameFolder = useCallback(async (id: string, name: string) => {
    const { error } = await (supabase as any).from('study_folders').update({ name }).eq('id', id);
    if (error) console.error('Error renaming folder:', error);
    await fetchFolders();
  }, [fetchFolders]);

  const deleteFolder = useCallback(async (id: string) => {
    const { error } = await (supabase as any).from('study_folders').delete().eq('id', id);
    if (error) console.error('Error deleting folder:', error);
    await fetchFolders();
  }, [fetchFolders]);

  const moveFolder = useCallback(async (id: string, newParentId: string | null) => {
    const { error } = await (supabase as any).from('study_folders').update({ parent_id: newParentId }).eq('id', id);
    if (error) console.error('Error moving folder:', error);
    await fetchFolders();
  }, [fetchFolders]);

  const getChildren = useCallback((parentId: string | null) => {
    return folders.filter(f => f.parentId === parentId);
  }, [folders]);

  const getFolderPath = useCallback((folderId: string | null): StudyFolder[] => {
    if (!folderId) return [];
    const path: StudyFolder[] = [];
    let current = folders.find(f => f.id === folderId);
    while (current) {
      path.unshift(current);
      current = current.parentId ? folders.find(f => f.id === current!.parentId) : undefined;
    }
    return path;
  }, [folders]);

  return { folders, loading, createFolder, renameFolder, deleteFolder, moveFolder, getChildren, getFolderPath, refetch: fetchFolders };
}
