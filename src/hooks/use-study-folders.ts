import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface StudyFolder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
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
      .order('sort_order')
      .order('name');

    if (error) { console.error('Error fetching folders:', error); setFolders([]); }
    else {
      setFolders((data as any[]).map((r: any) => ({
        id: r.id,
        name: r.name,
        parentId: r.parent_id || null,
        sortOrder: r.sort_order ?? 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);

  const createFolder = useCallback(async (name: string, parentId: string | null) => {
    if (!user?.id) return;
    // Get max sort_order for siblings
    const siblings = folders.filter(f => f.parentId === parentId);
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(f => f.sortOrder)) : -1;
    const payload: any = { name, user_id: user.id, sort_order: maxOrder + 1 };
    if (parentId) payload.parent_id = parentId;
    const { error } = await (supabase as any).from('study_folders').insert(payload);
    if (error) console.error('Error creating folder:', error);
    await fetchFolders();
  }, [user?.id, fetchFolders, folders]);

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

  const reorderFolder = useCallback(async (id: string, direction: 'up' | 'down') => {
    const folder = folders.find(f => f.id === id);
    if (!folder) return;
    const siblings = folders.filter(f => f.parentId === folder.parentId).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = siblings.findIndex(f => f.id === id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;

    const other = siblings[swapIdx];
    // Swap sort_order values
    await Promise.all([
      (supabase as any).from('study_folders').update({ sort_order: other.sortOrder }).eq('id', id),
      (supabase as any).from('study_folders').update({ sort_order: folder.sortOrder }).eq('id', other.id),
    ]);
    await fetchFolders();
  }, [folders, fetchFolders]);

  const getChildren = useCallback((parentId: string | null) => {
    return folders.filter(f => f.parentId === parentId).sort((a, b) => a.sortOrder - b.sortOrder);
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

  return { folders, loading, createFolder, renameFolder, deleteFolder, moveFolder, reorderFolder, getChildren, getFolderPath, refetch: fetchFolders };
}
