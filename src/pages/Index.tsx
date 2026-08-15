import { useState, useMemo, useCallback } from 'react';
import { PDFDocument, SearchContext } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useDocuments } from '@/hooks/use-documents';
import { PDFViewer } from '@/components/PDFViewer';
import { UploadDialog } from '@/components/UploadDialog';
import { EditDocumentDialog } from '@/components/EditDocumentDialog';
import { PDFCard } from '@/components/PDFCard';
import { useSettings } from '@/hooks/use-settings';
import { useReadingGoals } from '@/hooks/use-reading-goals';
import { useDocumentSummaries } from '@/hooks/use-document-summaries';
import { TabContentRenderer, TabContentProps } from '@/components/TabContentRenderer';
import { SplitViewSelector, TAB_OPTIONS } from '@/components/SplitViewSelector';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import {
  Upload,
  BookOpen,
  Star,
  CheckCircle2,
  FileText,
  FolderSearch,
  FolderTree,
  Settings,
  LogOut,
  Search,
  MoreHorizontal,
  PanelLeftClose,
  Columns2,
  Bot,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MetaTab } from '@/components/MetaTab';

const Index = () => {
  const { documents, loading, fetchDocuments, uploadDocument, toggleFavorite, deleteDocument, updateDocument, searchContent } = useDocuments();
  const { signOut } = useAuth();
  const settingsSeed = useMemo(() => ({
    authors: Array.from(new Set(documents.map((doc) => doc.author?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    translators: Array.from(new Set(documents.map((doc) => doc.translator?.trim()).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  }), [documents]);
  const { authors, translators, addAuthor, removeAuthor, addTranslator, removeTranslator } = useSettings(settingsSeed.authors, settingsSeed.translators);
  const { goal, progress, completedThisMonth, upsertGoal, startReading, markCompleted, unmarkCompleted, resetMonthlyProgress } = useReadingGoals();
  const { summaries, loading: summariesLoading, upsertSummary, deleteSummary } = useDocumentSummaries();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<PDFDocument | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);
  const [summarizeDoc, setSummarizeDoc] = useState<PDFDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<PDFDocument | null>(null);
  const [activeTab, setActiveTab] = useState('inicio');
  const [splitMode, setSplitMode] = useState(false);
  const [rightTab, setRightTab] = useState('biblia');
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('pinned_docs') || '[]'); } catch { return []; }
  });

  const togglePin = useCallback((id: string) => {
    setPinnedIds(prev => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter(x => x !== id);
      } else {
        next = [...prev.slice(0, 1), id].slice(0, 2);
        if (prev.length >= 2 && !prev.includes(id)) {
          next = [prev[0], id];
        }
      }
      localStorage.setItem('pinned_docs', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleViewDoc = (doc: PDFDocument, ctx?: SearchContext) => {
    setSearchContext(ctx || null);
    setViewingDoc(doc);
    startReading(doc.id);
  };

  const handleSummarizeWithAI = (doc: PDFDocument) => {
    setViewingDoc(null);
    setSearchContext(null);
    setSummarizeDoc(doc);
    setActiveTab('ia');
  };

  const tabContentProps: Omit<TabContentProps, 'tabId'> = {
    documents,
    onViewDoc: handleViewDoc,
    onToggleFavorite: toggleFavorite,
    onDelete: deleteDocument,
    onEdit: setEditingDoc,
    authors: authors.map(a => a.name),
    translators: translators.map(t => t.name),
    searchContent,
    summaries,
    summariesLoading,
    upsertSummary,
    deleteSummary,
    goal,
    completedThisMonth,
    upsertGoal,
    resetMonthlyProgress,
    progress,
    unmarkCompleted,
    settingsAuthors: authors,
    settingsTranslators: translators,
    addAuthor,
    removeAuthor,
    addTranslator,
    removeTranslator,
    renderHomeContent: (embedded?: boolean) => renderHomeContent(embedded),
    pendingSummarizeDoc: summarizeDoc,
    onSummarizeHandled: () => setSummarizeDoc(null),
  };

  const renderHomeContent = (embedded?: boolean) => (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
        {[
          { label: 'Total de PDFs', value: documents.length, icon: FileText },
          { label: 'Favoritos', value: documents.filter((d) => d.favorite).length, icon: Star },
        ].map((stat) => (
          <div key={stat.label} className="glass rounded-xl p-3 sm:p-4 flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-accent flex items-center justify-center">
              <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent documents */}
      {(() => {
        const latestProgressByDoc = new Map<string, typeof progress[number]>();
        for (const rp of progress) {
          if (!latestProgressByDoc.has(rp.document_id)) {
            latestProgressByDoc.set(rp.document_id, rp);
          }
        }
        const completedIds = new Set(
          Array.from(latestProgressByDoc.values())
            .filter((p) => p.completed)
            .map((p) => p.document_id)
        );
        const pinIdSet = new Set(pinnedIds);
        const pinDocs = pinnedIds
          .map(id => documents.find(d => d.id === id))
          .filter((d): d is PDFDocument => !!d && !completedIds.has(d.id));
        const recentDocs = Array.from(latestProgressByDoc.values())
          .filter((rp) => !rp.completed && !pinIdSet.has(rp.document_id))
          .map((rp) => documents.find((d) => d.id === rp.document_id))
          .filter((d): d is PDFDocument => !!d)
          .slice(0, 8);
        const recentWithDocs = [
          ...pinDocs.map(doc => ({ doc, pinned: true })),
          ...recentDocs.map(doc => ({ doc, pinned: false })),
        ];
        if (recentWithDocs.length === 0) return null;
        return (
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              Acessados Recentemente
            </h2>
            <div className={embedded ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"}>
              {recentWithDocs.map(({ doc, pinned }) => {
                const rp = latestProgressByDoc.get(doc.id);
                return (
                  <PDFCard
                    key={doc.id}
                    doc={doc}
                    viewMode="grid"
                    onView={handleViewDoc}
                    onToggleFavorite={toggleFavorite}
                    onDelete={deleteDocument}
                    onEdit={setEditingDoc}
                    onTogglePin={togglePin}
                    isPinned={pinned}
                    onMarkCompleted={markCompleted}
                    isCompleted={rp?.completed ?? false}
                  />
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Goals */}
      <div className="mt-6">
        <MetaTab
          documents={documents}
          completedThisMonth={completedThisMonth}
          goal={goal}
          upsertGoal={upsertGoal}
          resetMonthlyProgress={resetMonthlyProgress}
        />
      </div>
    </>
  );

  const toggleSplitMode = () => {
    setSplitMode(prev => !prev);
  };

  return (
    <>
      {viewingDoc && !splitMode && (
        <PDFViewer doc={viewingDoc} onBack={() => { setViewingDoc(null); setSearchContext(null); }} searchContext={searchContext} onSummarizeWithAI={handleSummarizeWithAI} />
      )}
    <div className={`${splitMode ? 'h-screen overflow-hidden flex flex-col' : 'min-h-screen pb-20 sm:pb-0'} bg-background safe-top safe-x sm:safe-bottom ${viewingDoc && !splitMode ? 'hidden' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary flex items-center justify-center glow-amber">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">Estudo Bíblico</h1>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5 hidden sm:block">Biblioteca Digital</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Split view toggle - desktop only */}
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={splitMode ? 'default' : 'outline'}
                    size="icon"
                    onClick={toggleSplitMode}
                    className="hidden sm:flex h-9 w-9 sm:h-10 sm:w-10"
                  >
                    {splitMode ? <PanelLeftClose className="w-4 h-4" /> : <Columns2 className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{splitMode ? 'Fechar visão dividida' : 'Dividir tela'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button onClick={() => setUploadOpen(true)} size="sm" className="glow-amber h-9 sm:h-10">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sair" className="h-9 w-9 sm:h-10 sm:w-10">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className={`max-w-7xl mx-auto px-4 sm:px-6 ${splitMode ? 'py-3 flex-1 min-h-0 flex flex-col w-full' : 'py-4 sm:py-6'}`}>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner size={32} />
          </div>
        ) : splitMode ? (
          /* ======== SPLIT VIEW MODE ======== */
          <ResizablePanelGroup direction="horizontal" className="min-h-[calc(100vh-160px)] rounded-xl border border-border/40 bg-card/30 shadow-sm">
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col">
                {/* Left panel header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-secondary/30 shrink-0">
                  <SplitViewSelector value={activeTab} onChange={setActiveTab} side="left" />
                  {viewingDoc && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setViewingDoc(null); setSearchContext(null); }}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                    >
                      <PanelLeftClose className="w-3.5 h-3.5" />
                      Fechar doc
                    </Button>
                  )}
                </div>
                <div className="flex-1 min-h-0 flex flex-col">
                  {viewingDoc ? (
                    <PDFViewer doc={viewingDoc} onBack={() => { setViewingDoc(null); setSearchContext(null); }} searchContext={searchContext} embedded onSummarizeWithAI={handleSummarizeWithAI} />
                  ) : (
                    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                      <div className="split-panel-content relative flex-1 min-h-0 overflow-y-auto p-4 [&:has(.mindmap-embedded-active)]:overflow-hidden [&:has(.mindmap-embedded-active)]:p-0">
                        <TabContentRenderer tabId={activeTab} {...tabContentProps} embedded />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50} minSize={20}>
              <div className="h-full flex flex-col">
                {/* Right panel header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-secondary/30 shrink-0">
                  <SplitViewSelector value={rightTab} onChange={setRightTab} side="right" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSplitMode}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive gap-1"
                  >
                    <PanelLeftClose className="w-3.5 h-3.5" />
                    Fechar
                  </Button>
                </div>
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                      <div className="split-panel-content relative flex-1 min-h-0 overflow-y-auto p-4 [&:has(.mindmap-embedded-active)]:overflow-hidden [&:has(.mindmap-embedded-active)]:p-0">
                        <TabContentRenderer tabId={rightTab} {...tabContentProps} embedded />
                      </div>
                    </div>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          /* ======== NORMAL TAB MODE ======== */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            {/* Desktop/Tablet tabs */}
            <div className="hidden sm:block overflow-x-auto scrollbar-none">
              <TabsList className="bg-secondary/50 w-auto">
                {TAB_OPTIONS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5 text-sm px-3">
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {TAB_OPTIONS.map((tab) => (
              <TabsContent key={tab.value} value={tab.value}>
                <TabContentRenderer tabId={tab.value} {...tabContentProps} />
              </TabsContent>
            ))}

            {/* Mobile bottom tab bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background/95 backdrop-blur-xl border-t border-border safe-bottom shadow-[0_-2px_12px_rgba(0,0,0,0.04)]">
              <TabsList className="w-full h-auto bg-transparent rounded-none grid grid-cols-7 gap-0 p-0">
                {[
                  { value: 'inicio', icon: BookOpen, label: 'Início' },
                  { value: 'biblia', icon: BookOpen, label: 'Bíblia' },
                  { value: 'documentos', icon: FolderSearch, label: 'Docs' },
                  { value: 'resumos', icon: FileText, label: 'Estudo' },
                  { value: 'pesquisa', icon: Search, label: 'Busca' },
                  { value: 'ia', icon: Bot, label: 'IA' },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="relative flex flex-col items-center gap-0.5 py-2.5 px-1 rounded-none text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none touch-target transition-colors before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:h-0.5 before:w-8 before:rounded-b-full before:bg-transparent data-[state=active]:before:bg-primary"
                  >
                    <tab.icon className="w-5 h-5" />
                    <span className="text-[10px] leading-tight font-medium">{tab.label}</span>
                  </TabsTrigger>
                ))}
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      className={`relative flex flex-col items-center gap-0.5 py-2.5 px-1 touch-target transition-colors ${
                        ['pastas', 'favoritos', 'concluidos', 'configuracoes'].includes(activeTab)
                          ? 'text-primary before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:h-0.5 before:w-8 before:rounded-b-full before:bg-primary'
                          : 'text-muted-foreground'
                      }`}
                    >
                      <MoreHorizontal className="w-5 h-5" />
                      <span className="text-[10px] leading-tight font-medium">Mais</span>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8 pt-3">
                    <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'pastas', icon: FolderTree, label: 'Pastas' },
                        { value: 'favoritos', icon: Star, label: 'Favoritos' },
                        { value: 'concluidos', icon: CheckCircle2, label: 'Concluídos' },
                        { value: 'configuracoes', icon: Settings, label: 'Config' },
                      ].map((tab) => (
                        <SheetTrigger key={tab.value} asChild>
                          <button
                            onClick={() => setActiveTab(tab.value)}
                            className={`flex items-center gap-3 py-4 px-4 rounded-xl transition-colors ${
                              activeTab === tab.value
                                ? 'bg-accent text-primary'
                                : 'bg-secondary/50 text-foreground hover:bg-secondary'
                            }`}
                          >
                            <tab.icon className="w-5 h-5 shrink-0" />
                            <span className="text-sm font-medium">{tab.label}</span>
                          </button>
                        </SheetTrigger>
                      ))}
                    </div>
                  </SheetContent>
                </Sheet>
              </TabsList>
            </div>
          </Tabs>
        )}
      </main>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUpload={uploadDocument}
        onComplete={fetchDocuments}
        authorsList={authors.map((a) => a.name)}
        translatorsList={translators.map((t) => t.name)}
      />

      <EditDocumentDialog
        doc={editingDoc}
        open={!!editingDoc}
        onOpenChange={(open) => { if (!open) setEditingDoc(null); }}
        onSave={updateDocument}
      />
    </div>
    </>
  );
};

export default Index;
