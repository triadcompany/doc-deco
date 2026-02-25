import { useState } from 'react';
import { PDFDocument } from '@/lib/types';
import { DocSummary } from '@/hooks/use-document-summaries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/RichTextEditor';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  FileText,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  BookOpen,
  ChevronsUpDown,
  Check,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

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
  const [comboOpen, setComboOpen] = useState(false);

  const normalizeForSearch = (text: string) =>
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const accentInsensitiveFilter = (value: string, search: string) => {
    if (!search) return 1;
    return normalizeForSearch(value).includes(normalizeForSearch(search)) ? 1 : 0;
  };

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

  const selectedDocTitle = selectedDocId ? getDocTitle(selectedDocId) : '';

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
                  <div
                    className="text-sm text-muted-foreground line-clamp-6 prose prose-sm max-w-none dark:prose-invert"
                    dangerouslySetInnerHTML={{ __html: s.summary }}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSummary ? 'Editar Resumo' : 'Novo Resumo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Documento</label>
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between font-normal"
                    disabled={!!editingSummary}
                  >
                    <span className="truncate">
                      {selectedDocTitle || 'Pesquisar documento...'}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command filter={accentInsensitiveFilter}>
                    <CommandInput placeholder="Pesquisar documento..." />
                    <CommandList>
                      <CommandEmpty>Nenhum documento encontrado.</CommandEmpty>
                      <CommandGroup>
                        {documents.map((d) => (
                          <CommandItem
                            key={d.id}
                            value={d.title}
                            onSelect={() => {
                              setSelectedDocId(d.id);
                              setComboOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedDocId === d.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">{d.title}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Resumo</label>
              <RichTextEditor
                key={editingSummary?.id || 'new'}
                value={summaryText}
                onChange={setSummaryText}
                placeholder="Escreva o resumo do documento..."
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
