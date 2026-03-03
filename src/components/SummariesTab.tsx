import { useState } from 'react';
import { PDFDocument } from '@/lib/types';
import { DocSummary } from '@/hooks/use-document-summaries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/RichTextEditor';
import { MindMapEditor } from '@/components/mindmap/MindMapEditor';
import { MindMapViewer } from '@/components/mindmap/MindMapViewer';
import { isMindMap } from '@/components/mindmap/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Eye,
  Network,
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

type StudyMode = 'text' | 'mindmap';

export function SummariesTab({ documents, summaries, loading, onUpsert, onDelete, onViewDoc }: SummariesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState<DocSummary | null>(null);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [studyMode, setStudyMode] = useState<StudyMode>('text');
  const [saving, setSaving] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [viewingSummary, setViewingSummary] = useState<DocSummary | null>(null);

  const normalizeForSearch = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  const accentInsensitiveFilter = (value: string, search: string) => {
    if (!search) return 1;
    return normalizeForSearch(value).includes(normalizeForSearch(search)) ? 1 : 0;
  };

  const openNew = () => {
    setEditingSummary(null);
    setSelectedDocId('');
    setSummaryText('');
    setStudyMode('text');
    setDialogOpen(true);
  };

  const openEdit = (s: DocSummary) => {
    setEditingSummary(s);
    setSelectedDocId(s.documentId);
    setSummaryText(s.summary);
    setStudyMode(isMindMap(s.summary) ? 'mindmap' : 'text');
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

  const isCurrentMindMap = studyMode === 'mindmap';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          Meus Estudos
        </h2>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="w-4 h-4" />
          Novo Estudo
        </Button>
      </div>

      {summaries.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhum estudo criado</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Crie estudos dos seus documentos para consultar depois</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {summaries.map((s) => {
            const doc = getDoc(s.documentId);
            const isMM = isMindMap(s.summary);
            return (
              <Card key={s.id} className="group cursor-pointer" onClick={() => setViewingSummary(s)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium truncate flex-1 flex items-center gap-1.5">
                      {isMM && <Network className="w-3.5 h-3.5 text-primary shrink-0" />}
                      {getDocTitle(s.documentId)}
                    </CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                      {doc && onViewDoc && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onViewDoc(doc)} title="Abrir documento">
                          <BookOpen className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewingSummary(s)} title="Visualizar estudo">
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)} title="Editar estudo">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(s.id)} title="Excluir estudo">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Atualizado em {format(new Date(s.updatedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                </CardHeader>
                <CardContent>
                  {isMM ? (
                    <div className="h-32 rounded overflow-hidden pointer-events-none">
                      <MindMapViewer value={s.summary} className="w-full h-full" />
                    </div>
                  ) : (
                    <div
                      className="text-sm line-clamp-6 max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:mb-1 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:mb-1 [&_p]:text-sm [&_p]:leading-relaxed [&_b]:font-bold [&_i]:italic"
                      dangerouslySetInnerHTML={{ __html: s.summary }}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto", isCurrentMindMap ? "max-w-4xl" : "max-w-2xl")}>
          <DialogHeader>
            <DialogTitle>{editingSummary ? 'Editar Estudo' : 'Novo Estudo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Document selector */}
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
                    <span className="truncate">{selectedDocTitle || 'Pesquisar documento...'}</span>
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
                            onSelect={() => { setSelectedDocId(d.id); setComboOpen(false); }}
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

            {/* Mode toggle */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">Formato</label>
              <Tabs value={studyMode} onValueChange={(v) => setStudyMode(v as StudyMode)}>
                <TabsList className="w-full">
                  <TabsTrigger value="text" className="flex-1 gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Texto
                  </TabsTrigger>
                  <TabsTrigger value="mindmap" className="flex-1 gap-1.5">
                    <Network className="w-3.5 h-3.5" /> Mapa Mental
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Editor */}
            <div>
              {studyMode === 'text' ? (
                <>
                  <label className="text-sm font-medium mb-1.5 block">Estudo</label>
                  <RichTextEditor
                    key={editingSummary?.id || 'new'}
                    value={isMindMap(summaryText) ? '' : summaryText}
                    onChange={setSummaryText}
                    placeholder="Escreva o estudo do documento..."
                  />
                </>
              ) : (
                <MindMapEditor
                  key={`mm-${editingSummary?.id || 'new'}`}
                  initialValue={isMindMap(summaryText) ? summaryText : undefined}
                  onChange={setSummaryText}
                />
              )}
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

      {/* View Summary Dialog */}
      <Dialog open={!!viewingSummary} onOpenChange={(open) => !open && setViewingSummary(null)}>
        <DialogContent className={cn("max-h-[90vh] overflow-y-auto", viewingSummary && isMindMap(viewingSummary.summary) ? "max-w-4xl" : "max-w-2xl")}>
          <DialogHeader>
            <DialogTitle className="text-base">
              {viewingSummary ? getDocTitle(viewingSummary.documentId) : ''}
            </DialogTitle>
            {viewingSummary && (
              <p className="text-xs text-muted-foreground">
                Atualizado em {format(new Date(viewingSummary.updatedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
              </p>
            )}
          </DialogHeader>
          {viewingSummary && (
            isMindMap(viewingSummary.summary) ? (
              <MindMapViewer value={viewingSummary.summary} className="w-full h-[500px] rounded-lg border" interactive />
            ) : (
              <div
                className="max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_b]:font-bold [&_i]:italic"
                dangerouslySetInnerHTML={{ __html: viewingSummary.summary }}
              />
            )
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingSummary(null)}>Fechar</Button>
            <Button onClick={() => { if (viewingSummary) { openEdit(viewingSummary); setViewingSummary(null); } }}>
              <Pencil className="w-4 h-4 mr-1" />
              Editar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
