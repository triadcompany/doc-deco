import { useState } from 'react';
import { PDFDocument } from '@/lib/types';
import { DocSummary } from '@/hooks/use-document-summaries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RichTextEditor } from '@/components/RichTextEditor';
import { MindMapEditor } from '@/components/mindmap/MindMapEditor';
import { MindMapViewer } from '@/components/mindmap/MindMapViewer';
import { isMindMap } from '@/components/mindmap/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
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
  X,
  Search,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Settings2,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SummariesTabProps {
  documents: PDFDocument[];
  summaries: DocSummary[];
  loading: boolean;
  onUpsert: (id: string | null, title: string, documentIds: string[], summary: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onViewDoc?: (doc: PDFDocument) => void;
  embedded?: boolean;
}

type StudyMode = 'text' | 'mindmap';
type InlineView = null | 'create' | 'edit' | 'view';

export function SummariesTab({ documents, summaries, loading, onUpsert, onDelete, onViewDoc, embedded = false }: SummariesTabProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSummary, setEditingSummary] = useState<DocSummary | null>(null);
  const [studyTitle, setStudyTitle] = useState('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [summaryText, setSummaryText] = useState('');
  const [studyMode, setStudyMode] = useState<StudyMode>('text');
  const [saving, setSaving] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [viewingSummary, setViewingSummary] = useState<DocSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [inlineView, setInlineView] = useState<InlineView>(null);

  const normalizeForSearch = (text: string) =>
    text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();

  const accentInsensitiveFilter = (value: string, search: string) => {
    if (!search) return 1;
    return normalizeForSearch(value).includes(normalizeForSearch(search)) ? 1 : 0;
  };

  const resetForm = () => {
    setEditingSummary(null);
    setStudyTitle('');
    setSelectedDocIds([]);
    setSummaryText('');
    setStudyMode('text');
  };

  const openNew = () => {
    resetForm();
    if (embedded) {
      setInlineView('create');
    } else {
      setDialogOpen(true);
    }
  };

  const openEdit = (s: DocSummary) => {
    setEditingSummary(s);
    setStudyTitle(s.title);
    setSelectedDocIds(s.documentIds);
    setSummaryText(s.summary);
    setStudyMode(isMindMap(s.summary) ? 'mindmap' : 'text');
    if (embedded) {
      setInlineView('edit');
    } else {
      setDialogOpen(true);
    }
  };

  const openView = (s: DocSummary) => {
    setViewingSummary(s);
    if (embedded) {
      setInlineView('view');
    }
  };

  const goBackToList = () => {
    setInlineView(null);
    setViewingSummary(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!studyTitle.trim() || !summaryText.trim()) return;
    setSaving(true);
    await onUpsert(editingSummary?.id || null, studyTitle.trim(), selectedDocIds, summaryText.trim());
    setSaving(false);
    if (embedded) {
      goBackToList();
    } else {
      setDialogOpen(false);
    }
  };

  const toggleDocSelection = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId],
    );
  };

  const removeDoc = (docId: string) => {
    setSelectedDocIds((prev) => prev.filter((id) => id !== docId));
  };

  const getDocTitle = (docId: string) => {
    const doc = documents.find((d) => d.id === docId);
    return doc?.title || 'Documento removido';
  };

  const getDoc = (docId: string) => documents.find((d) => d.id === docId);

  const getStudyDisplayTitle = (s: DocSummary) => {
    if (s.title) return s.title;
    if (s.documentIds.length > 0) return getDocTitle(s.documentIds[0]);
    return 'Sem título';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isCurrentMindMap = studyMode === 'mindmap';

  // Filter summaries by search query (title + content)
  const filteredSummaries = summaries.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = normalizeForSearch(searchQuery);
    const title = normalizeForSearch(getStudyDisplayTitle(s));
    if (title.includes(q)) return true;
    const plainContent = normalizeForSearch(s.summary.replace(/<[^>]*>/g, ''));
    if (plainContent.includes(q)) return true;
    const docTitles = s.documentIds.map((id) => normalizeForSearch(getDocTitle(id))).join(' ');
    return docTitles.includes(q);
  });

  // ===== Document selector (shared between inline and dialog) =====
  const renderDocSelector = () => (
    <div>
      <label className="text-sm font-medium mb-1.5 block">
        Documentos <span className="text-muted-foreground font-normal">(opcional)</span>
      </label>
      
      {selectedDocIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedDocIds.map((docId) => (
            <Badge key={docId} variant="secondary" className="gap-1 pr-1 text-xs">
              <span className="truncate max-w-[180px]">{getDocTitle(docId)}</span>
              <button
                onClick={() => removeDoc(docId)}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Popover open={comboOpen} onOpenChange={setComboOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={comboOpen}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-muted-foreground">
              {selectedDocIds.length === 0
                ? 'Vincular documentos...'
                : `${selectedDocIds.length} documento${selectedDocIds.length > 1 ? 's' : ''} vinculado${selectedDocIds.length > 1 ? 's' : ''}`}
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
                    onSelect={() => toggleDocSelection(d.id)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selectedDocIds.includes(d.id) ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{d.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );

  // ===== Editor area (shared) =====
  const renderEditor = () => (
    <>
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
      <div className={cn('flex flex-col', embedded && isCurrentMindMap ? 'flex-1 min-h-0' : 'flex-1 min-h-0')}>
        {studyMode === 'text' ? (
          <>
            <label className="text-sm font-medium mb-1.5 block">Conteúdo</label>
            <RichTextEditor
              key={editingSummary?.id || 'new'}
              value={isMindMap(summaryText) ? '' : summaryText}
              onChange={setSummaryText}
              placeholder="Escreva o conteúdo do estudo..."
              fillHeight={embedded}
            />
          </>
        ) : (
          <MindMapEditor
            key={`mm-${editingSummary?.id || 'new'}`}
            initialValue={isMindMap(summaryText) ? summaryText : undefined}
            onChange={setSummaryText}
            fillHeight={embedded}
          />
        )}
      </div>
    </>
  );

  // ===== INLINE VIEW (for split view / embedded) =====
  if (embedded && inlineView === 'view' && viewingSummary) {
    const isMM = isMindMap(viewingSummary.summary);
    return (
      <div className="study-inline-view absolute inset-0 flex flex-col bg-background p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={goBackToList} className="gap-1 h-8 px-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{getStudyDisplayTitle(viewingSummary)}</h3>
            {viewingSummary.documentIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-0.5">
                {viewingSummary.documentIds.map((docId) => (
                  <Badge key={docId} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal max-w-[150px] truncate">
                    {getDocTitle(docId)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={() => { openEdit(viewingSummary); }} className="gap-1 h-8 shrink-0">
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {isMM ? (
            <MindMapViewer value={viewingSummary.summary} className="w-full h-full min-h-[400px] rounded-lg border" interactive />
          ) : (
            <div
              className="max-w-none pr-2 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:mb-2 [&_p]:text-sm [&_p]:leading-relaxed [&_b]:font-bold [&_i]:italic"
              dangerouslySetInnerHTML={{ __html: viewingSummary.summary }}
            />
          )}
        </div>
      </div>
    );
  }

  if (embedded && (inlineView === 'create' || inlineView === 'edit')) {
    // In mind map mode, use a compact layout that fills the entire panel
    if (isCurrentMindMap) {
      return (
        <div className="flex flex-col h-full mindmap-embedded-active">
          {/* Compact sticky header */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-secondary/30 shrink-0">
            <Button variant="ghost" size="sm" onClick={goBackToList} className="gap-1 h-7 px-1.5 text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
            </Button>
            <div className="flex-1 min-w-0">
              <Input
                value={studyTitle}
                onChange={(e) => setStudyTitle(e.target.value)}
                placeholder="Nome do estudo..."
                className="h-7 text-xs border-none bg-transparent shadow-none focus-visible:ring-0 px-1"
              />
            </div>
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-1.5 text-xs gap-1 text-muted-foreground">
                  <Settings2 className="w-3 h-3" />
                  {selectedDocIds.length > 0 && (
                    <Badge variant="secondary" className="text-[9px] py-0 px-1 h-4">{selectedDocIds.length}</Badge>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="absolute top-full left-0 right-0 z-20 bg-popover border-b border-border shadow-lg p-3 space-y-2">
                {renderDocSelector()}
              </CollapsibleContent>
            </Collapsible>
            <Tabs value={studyMode} onValueChange={(v) => setStudyMode(v as StudyMode)}>
              <TabsList className="h-7">
                <TabsTrigger value="text" className="h-6 text-[10px] px-2 gap-1">
                  <FileText className="w-3 h-3" /> Texto
                </TabsTrigger>
                <TabsTrigger value="mindmap" className="h-6 text-[10px] px-2 gap-1">
                  <Network className="w-3 h-3" /> Mapa
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" onClick={handleSave} disabled={!studyTitle.trim() || !summaryText.trim() || saving} className="h-7 text-xs px-2.5">
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Salvar
            </Button>
          </div>
          {/* Mind map fills remaining space */}
          <div className="flex-1 min-h-0">
            <MindMapEditor
              key={`mm-${editingSummary?.id || 'new'}`}
              initialValue={isMindMap(summaryText) ? summaryText : undefined}
              onChange={setSummaryText}
              fillHeight
              compact
            />
          </div>
        </div>
      );
    }

    // Text mode: normal scrollable form
    return (
      <div className="study-inline-view absolute inset-0 flex flex-col bg-background p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Button variant="ghost" size="sm" onClick={goBackToList} className="gap-1 h-8 px-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <h3 className="text-sm font-semibold flex-1">
            {inlineView === 'edit' ? 'Editar Estudo' : 'Novo Estudo'}
          </h3>
          <Button size="sm" onClick={handleSave} disabled={!studyTitle.trim() || !summaryText.trim() || saving} className="gap-1 h-8">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Nome do Estudo</label>
            <Input
              value={studyTitle}
              onChange={(e) => setStudyTitle(e.target.value)}
              placeholder="Ex: Sonhos e Visões - Resumo"
            />
          </div>
          {renderDocSelector()}
          {renderEditor()}
        </div>
      </div>
    );
  }

  // ===== LIST VIEW (default) =====
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

      {/* Search bar */}
      {summaries.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar por título ou conteúdo..."
            className="pl-9"
          />
        </div>
      )}

      {summaries.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhum estudo criado</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Crie estudos dos seus documentos para consultar depois</p>
        </div>
      ) : filteredSummaries.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground">Nenhum estudo encontrado</p>
          <p className="text-sm text-muted-foreground/60 mt-1">Tente outro termo de pesquisa</p>
        </div>
      ) : (
        <div className={cn("grid gap-4", embedded ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
          {filteredSummaries.map((s) => {
            const isMM = isMindMap(s.summary);
            return (
              <Card key={s.id} className="group cursor-pointer" onClick={() => openView(s)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-medium flex-1 flex items-center gap-1.5 min-w-0">
                      {isMM && <Network className="w-3.5 h-3.5 text-primary shrink-0" />}
                      <span className="truncate">{getStudyDisplayTitle(s)}</span>
                    </CardTitle>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openView(s)} title="Visualizar estudo">
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
                  {s.documentIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {s.documentIds.map((docId) => (
                        <Badge key={docId} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal max-w-[150px] truncate">
                          {getDocTitle(docId)}
                        </Badge>
                      ))}
                    </div>
                  )}
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

      {/* Create/Edit Dialog (non-embedded only) */}
      {!embedded && (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className={cn(
            "flex flex-col",
            isCurrentMindMap
              ? "max-w-[95vw] w-full md:max-w-[90vw] lg:max-w-6xl max-h-[95vh] h-[95vh] md:h-[90vh]"
              : "max-w-2xl max-h-[90vh]"
          )}>
            <DialogHeader className="shrink-0">
              <DialogTitle>{editingSummary ? 'Editar Estudo' : 'Novo Estudo'}</DialogTitle>
            </DialogHeader>
            <div className={cn("flex-1 min-h-0 flex flex-col", isCurrentMindMap ? "gap-2 overflow-hidden" : "space-y-4 overflow-y-auto")}>
              <div className="shrink-0">
                <label className="text-sm font-medium mb-1.5 block">Nome do Estudo</label>
                <Input
                  value={studyTitle}
                  onChange={(e) => setStudyTitle(e.target.value)}
                  placeholder="Ex: Sonhos e Visões - Resumo"
                />
              </div>
              <div className="shrink-0">{renderDocSelector()}</div>
              <div className={cn(isCurrentMindMap ? "flex-1 min-h-0" : "")}>{renderEditor()}</div>
            </div>
            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!studyTitle.trim() || !summaryText.trim() || saving}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* View Summary Dialog (non-embedded only) */}
      {!embedded && (
        <Dialog open={!!viewingSummary} onOpenChange={(open) => !open && setViewingSummary(null)}>
          <DialogContent className={cn(
            "max-h-[90vh] overflow-y-auto",
            viewingSummary && isMindMap(viewingSummary.summary)
              ? "max-w-[95vw] w-full md:max-w-[90vw] lg:max-w-5xl"
              : "max-w-2xl"
          )}>
            <DialogHeader>
              <DialogTitle className="text-base">
                {viewingSummary ? getStudyDisplayTitle(viewingSummary) : ''}
              </DialogTitle>
              {viewingSummary && viewingSummary.documentIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {viewingSummary.documentIds.map((docId) => (
                    <Badge key={docId} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal max-w-[200px] truncate">
                      {getDocTitle(docId)}
                    </Badge>
                  ))}
                </div>
              )}
              {viewingSummary && (
                <p className="text-xs text-muted-foreground">
                  Atualizado em {format(new Date(viewingSummary.updatedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                </p>
              )}
            </DialogHeader>
            {viewingSummary && (
              isMindMap(viewingSummary.summary) ? (
                <MindMapViewer value={viewingSummary.summary} className="w-full h-[60vh] min-h-[300px] rounded-lg border" interactive />
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
      )}
    </div>
  );
}
