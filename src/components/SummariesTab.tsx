import { useState } from 'react';
import { PDFDocument } from '@/lib/types';
import { DocSummary } from '@/hooks/use-document-summaries';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SummariesTabProps {
  documents: PDFDocument[];
  summaries: DocSummary[];
  loading: boolean;
  onUpsert: (documentId: string, summary: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onViewDoc?: (doc: PDFDocument) => void;
}

export function SummariesTab({ documents, summaries, loading, onUpsert, onDelete, onViewDoc }: SummariesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState<DocSummary | null>(null);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingSummary(null);
    setSelectedDocId('');
    setSummaryText('');
    setDialogOpen(true);
  };

  const openEdit = (s: DocSummary) => {
    setEditingSummary(s);
    setSelectedDocId(s.documentId);
    setSummaryText(s.summary);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedDocId || !summaryText.trim()) return;
    setSaving(true);
    await onUpsert(selectedDocId, summaryText.trim());
    setSaving(false);
    setDialogOpen(false);
  };

  const getDocTitle = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    return doc?.title || 'Documento removido';
  };

  const getDoc = (docId: string) => documents.find((d) => d.id === docId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Meus Resumos
        </h2>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Novo Resumo
        </Button>
      </div>

      {summaries.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhum resumo criado</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Crie resumos dos seus documentos para consultar depois</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaries.map((s) => {
            const doc = getDoc(s.documentId);
            return (
              <Card key={s.id} className="group">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium truncate flex-1">
                      {getDocTitle(s.documentId)}
                    </CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {doc && onViewDoc && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDoc(doc)} title="Abrir documento">
                          <BookOpen className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)} title="Editar resumo">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(s.id)} title="Excluir resumo">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Atualizado em {format(new Date(s.updatedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-6">{s.summary}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSummary ? 'Editar Resumo' : 'Novo Resumo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Documento</label>
              <Select value={selectedDocId} onValueChange={setSelectedDocId} disabled={!!editingSummary}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um documento" />
                </SelectTrigger>
                <SelectContent>
                  {documents.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Resumo</label>
              <Textarea
                value={summaryText}
                onChange={(e) => setSummaryText(e.target.value)}
                placeholder="Escreva o resumo do documento..."
                className="min-h-[200px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!selectedDocId || !summaryText.trim() || saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
