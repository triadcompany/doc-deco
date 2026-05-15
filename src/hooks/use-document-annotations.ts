import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';

export interface DocAnnotation {
  id: string;
  documentId: string;
  page: number;
  text: string;
  color: string;
  note?: string;
  position: any; // JSONB: { rects } | { type:'drawing', strokes, strokeWidth, color } | { type:'textbox', x, y, content, fontSize, color }
  createdAt: string;
}

function toApp(row: any): DocAnnotation {
  return {
    id: row.id,
    documentId: row.document_id,
    page: row.page,
    text: row.text,
    color: row.color,
    note: row.note ?? undefined,
    position: row.position,
    createdAt: row.created_at,
  };
}

export function useDocumentAnnotations(documentId: string | undefined) {
  const { user } = useAuth();
  const [annotations, setAnnotations] = useState<DocAnnotation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAnnotations = useCallback(async () => {
    if (!user?.id || !documentId) {
      setAnnotations([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('document_annotations')
      .select('*')
      .eq('document_id', documentId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching annotations:', error);
      setAnnotations([]);
    } else {
      setAnnotations((data as any[]).map(toApp));
    }
    setLoading(false);
  }, [user?.id, documentId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  useEffect(() => {
    if (!documentId) return;
    const channel = supabase
      .channel(`doc-annotations-${documentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_annotations' }, () => {
        fetchAnnotations();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [documentId, fetchAnnotations]);

  const addAnnotation = useCallback(async (ann: {
    page: number;
    text: string;
    color: string;
    rects: { top: number; left: number; width: number; height: number }[];
    note?: string;
  }) => {
    if (!user?.id || !documentId) return;
    const { error } = await supabase.from('document_annotations').insert({
      document_id: documentId,
      user_id: user.id,
      page: ann.page,
      text: ann.text,
      color: ann.color,
      note: ann.note || null,
      position: { rects: ann.rects },
    } as any);
    if (error) console.error('Error adding annotation:', error);
  }, [user?.id, documentId]);

  const addDrawing = useCallback(async (drawing: {
    page: number;
    strokes: { x: number; y: number }[][];
    strokeWidth: number;
    color: string;
  }) => {
    if (!user?.id || !documentId) return;
    const { error } = await supabase.from('document_annotations').insert({
      document_id: documentId,
      user_id: user.id,
      page: drawing.page,
      text: '',
      color: drawing.color,
      note: null,
      position: { type: 'drawing', strokes: drawing.strokes, strokeWidth: drawing.strokeWidth, color: drawing.color },
    } as any);
    if (error) console.error('Error adding drawing:', error);
  }, [user?.id, documentId]);

  const addTextBox = useCallback(async (tb: {
    page: number;
    x: number;
    y: number;
    content: string;
    fontSize: number;
    color: string;
  }) => {
    if (!user?.id || !documentId) return;
    const { error } = await supabase.from('document_annotations').insert({
      document_id: documentId,
      user_id: user.id,
      page: tb.page,
      text: tb.content,
      color: tb.color,
      note: null,
      position: { type: 'textbox', x: tb.x, y: tb.y, content: tb.content, fontSize: tb.fontSize, color: tb.color },
    } as any);
    if (error) console.error('Error adding text box:', error);
  }, [user?.id, documentId]);

  const updateAnnotation = useCallback(async (id: string, position: any) => {
    if (!user?.id) return;
    setAnnotations((prev) => prev.map((a) => (a.id === id ? { ...a, position } : a)));
    const { error } = await supabase.from('document_annotations').update({ position } as any).eq('id', id);
    if (error) { console.error('Error updating annotation:', error); fetchAnnotations(); }
  }, [user?.id, fetchAnnotations]);

  const removeAnnotation = useCallback(async (id: string) => {
    const { error } = await supabase.from('document_annotations').delete().eq('id', id);
    if (error) console.error('Error removing annotation:', error);
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const clearPageAnnotations = useCallback(async (page: number) => {
    if (!user?.id || !documentId) return;
    const ids = annotations.filter((a) => a.page === page).map((a) => a.id);
    if (ids.length === 0) return;
    const { error } = await supabase.from('document_annotations').delete().in('id', ids);
    if (error) console.error('Error clearing annotations:', error);
    setAnnotations((prev) => prev.filter((a) => a.page !== page));
  }, [user?.id, documentId, annotations]);

  return { annotations, loading, addAnnotation, addDrawing, addTextBox, updateAnnotation, removeAnnotation, clearPageAnnotations };
}
