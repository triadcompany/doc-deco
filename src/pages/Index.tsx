import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { PDFDocument, SearchContext } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useDocuments } from '@/hooks/use-documents';
import { PDFViewer } from '@/components/PDFViewer';
import { UploadDialog } from '@/components/UploadDialog';
import { EditDocumentDialog } from '@/components/EditDocumentDialog';
import { DocumentsTab } from '@/components/DocumentsTab';
import { PDFCard } from '@/components/PDFCard';
import { SearchTab } from '@/components/SearchTab';
import { FoldersTab } from '@/components/FoldersTab';
import { FavoritesTab } from '@/components/FavoritesTab';
import { CurrentReadings } from '@/components/CurrentReadings';
import { useSettings } from '@/hooks/use-settings';
import { useReadingGoals } from '@/hooks/use-reading-goals';
import { Progress } from '@/components/ui/progress';
import { useDocumentSummaries } from '@/hooks/use-document-summaries';

const SettingsTab = lazy(() => import('@/components/SettingsTab').then(m => ({ default: m.SettingsTab })));
const MetaTab = lazy(() => import('@/components/MetaTab').then(m => ({ default: m.MetaTab })));
const BibleTab = lazy(() => import('@/components/BibleTab').then(m => ({ default: m.BibleTab })));
const SummariesTab = lazy(() => import('@/components/SummariesTab').then(m => ({ default: m.SummariesTab })));
import { Button } from '@/components/ui/button';

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Upload,
  BookOpen,
  Star,
  
  FileText,
  FolderSearch,
  FolderTree,
  Loader2,
  Settings,
  LogOut,
  Target,
  Search,
} from 'lucide-react';

const Index = () => {
  const { documents, loading, fetchDocuments, uploadDocument, toggleFavorite, deleteDocument, updateDocument, searchContent } = useDocuments();
  const { signOut } = useAuth();
  const { authors, translators, addAuthor, removeAuthor, addTranslator, removeTranslator } = useSettings();
  const { goal, progress, currentReadings, completedThisMonth, upsertGoal, startReading, markCompleted, removeReading } = useReadingGoals();
  const { summaries, loading: summariesLoading, upsertSummary, deleteSummary } = useDocumentSummaries();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<PDFDocument | null>(null);
  const [searchContext, setSearchContext] = useState<SearchContext | null>(null);
  const [editingDoc, setEditingDoc] = useState<PDFDocument | null>(null);
  const [activeTab, setActiveTab] = useState('inicio');

  const handleViewDoc = (doc: PDFDocument, ctx?: SearchContext) => {
    setSearchContext(ctx || null);
    setViewingDoc(doc);
    // Track access for "recently accessed" feature
    startReading(doc.id);
  };


  return (
    <>
      {viewingDoc && (
        <PDFViewer doc={viewingDoc} onBack={() => { setViewingDoc(null); setSearchContext(null); }} searchContext={searchContext} />
      )}
    <div className={`min-h-screen bg-background safe-top safe-x pb-20 sm:pb-0 sm:safe-bottom ${viewingDoc ? 'hidden' : ''}`}>
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary flex items-center justify-center glow-amber">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight">DocVault</h1>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground -mt-0.5 hidden sm:block">Biblioteca Digital</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
            {/* Desktop/Tablet tabs - hidden on mobile */}
            <div className="hidden sm:block overflow-x-auto scrollbar-none">
              <TabsList className="bg-secondary/50 w-auto">
                <TabsTrigger value="inicio" className="gap-1.5 text-sm px-3">
                  <BookOpen className="w-3.5 h-3.5" />
                  Início
                </TabsTrigger>
                <TabsTrigger value="documentos" className="gap-1.5 text-sm px-3">
                  <FolderSearch className="w-3.5 h-3.5" />
                  Documentos
                </TabsTrigger>
                <TabsTrigger value="pastas" className="gap-1.5 text-sm px-3">
                  <FolderTree className="w-3.5 h-3.5" />
                  Pastas
                </TabsTrigger>
                <TabsTrigger value="favoritos" className="gap-1.5 text-sm px-3">
                  <Star className="w-3.5 h-3.5" />
                  Favoritos
                </TabsTrigger>
                <TabsTrigger value="pesquisa" className="gap-1.5 text-sm px-3">
                  <Search className="w-3.5 h-3.5" />
                  Pesquisa
                </TabsTrigger>
                <TabsTrigger value="resumos" className="gap-1.5 text-sm px-3">
                  <FileText className="w-3.5 h-3.5" />
                  Estudo
                </TabsTrigger>
                <TabsTrigger value="biblia" className="gap-1.5 text-sm px-3">
                  <BookOpen className="w-3.5 h-3.5" />
                  Bíblia
                </TabsTrigger>
                <TabsTrigger value="configuracoes" className="gap-1.5 text-sm px-3">
                  <Settings className="w-3.5 h-3.5" />
                  Config
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="inicio">
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

              {/* Recent documents — last 5 accessed */}
              {(() => {
                // Use progress data if available, otherwise fall back to most recent documents
                let recentWithDocs: { doc: PDFDocument; currentPage: number }[] = [];

                if (progress.length > 0) {
                  const seen = new Set<string>();
                  const recent5: typeof progress = [];
                  for (const rp of progress) {
                    if (!seen.has(rp.document_id)) {
                      seen.add(rp.document_id);
                      recent5.push(rp);
                    }
                    if (recent5.length >= 5) break;
                  }
                  recentWithDocs = recent5
                    .map(rp => ({ doc: documents.find(d => d.id === rp.document_id)!, currentPage: rp.current_page }))
                    .filter(x => !!x.doc);
                }

                // Fallback: show 5 most recently updated documents
                if (recentWithDocs.length === 0 && documents.length > 0) {
                  recentWithDocs = [...documents]
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                    .slice(0, 5)
                    .map(doc => ({ doc, currentPage: 0 }));
                }

                if (recentWithDocs.length === 0) return null;

                return (
                  <div className="mb-6">
                    <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      Acessados Recentemente
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {recentWithDocs.map(({ doc }) => (
                        <PDFCard
                          key={doc.id}
                          doc={doc}
                          viewMode="grid"
                          onView={handleViewDoc}
                          onToggleFavorite={toggleFavorite}
                          onDelete={deleteDocument}
                          onEdit={setEditingDoc}
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Current Readings */}
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Leituras Atuais
              </h2>
              {currentReadings.length > 0 ? (
                <CurrentReadings
                  documents={documents}
                  currentReadings={currentReadings}
                  onView={(doc) => handleViewDoc(doc)}
                  onMarkCompleted={markCompleted}
                  onRemove={removeReading}
                />
              ) : (
                <div className="text-center py-16">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">Nenhuma leitura em andamento</p>
                  <p className="text-sm text-muted-foreground/60 mt-1">Abra um documento para iniciar uma leitura</p>
                </div>
              )}

              {/* Goals / Meta section */}
              <div className="mt-6">
                <Suspense fallback={<div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
                  <MetaTab
                    documents={documents}
                    completedThisMonth={completedThisMonth}
                    goal={goal}
                    upsertGoal={upsertGoal}
                  />
                </Suspense>
              </div>
            </TabsContent>

            <TabsContent value="documentos">
              <DocumentsTab
                documents={documents}
                onView={(doc) => handleViewDoc(doc)}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteDocument}
                onEdit={setEditingDoc}
              />
            </TabsContent>

            <TabsContent value="pastas">
              <FoldersTab
                documents={documents}
                onView={(doc) => handleViewDoc(doc)}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteDocument}
                onEdit={setEditingDoc}
              />
            </TabsContent>

            <TabsContent value="favoritos">
              <FavoritesTab
                documents={documents}
                onView={(doc) => handleViewDoc(doc)}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteDocument}
                onEdit={setEditingDoc}
              />
            </TabsContent>

            <TabsContent value="pesquisa">
              <SearchTab
                documents={documents}
                onView={(doc, ctx) => handleViewDoc(doc, ctx)}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteDocument}
                authorsList={authors.map((a) => a.name)}
                translatorsList={translators.map((t) => t.name)}
                searchContent={searchContent}
              />
            </TabsContent>


            <TabsContent value="resumos">
              <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
                <SummariesTab
                  documents={documents}
                  summaries={summaries}
                  loading={summariesLoading}
                  onUpsert={upsertSummary}
                  onDelete={deleteSummary}
                  onViewDoc={(doc) => handleViewDoc(doc)}
                />
              </Suspense>
            </TabsContent>

            <TabsContent value="biblia">
              <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
                <BibleTab />
              </Suspense>
            </TabsContent>

            <TabsContent value="configuracoes">
              <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
                <SettingsTab
                  authors={authors}
                  translators={translators}
                  addAuthor={addAuthor}
                  removeAuthor={removeAuthor}
                  addTranslator={addTranslator}
                  removeTranslator={removeTranslator}
                />
              </Suspense>
            </TabsContent>

            {/* Mobile bottom tab bar */}
            <div className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-background/95 backdrop-blur-xl border-t border-border safe-bottom">
              <TabsList className="w-full h-auto bg-transparent rounded-none grid grid-cols-9 gap-0 p-0">
                {[
                  { value: 'inicio', icon: BookOpen, label: 'Início' },
                  { value: 'documentos', icon: FolderSearch, label: 'Docs' },
                  { value: 'pastas', icon: FolderTree, label: 'Pastas' },
                  { value: 'favoritos', icon: Star, label: 'Favoritos' },
                  { value: 'pesquisa', icon: Search, label: 'Busca' },
                  
                  { value: 'resumos', icon: FileText, label: 'Estudo' },
                  { value: 'biblia', icon: BookOpen, label: 'Bíblia' },
                  { value: 'configuracoes', icon: Settings, label: 'Config' },
                ].map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex flex-col items-center gap-0.5 py-2 px-0 rounded-none text-muted-foreground data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="text-[9px] leading-tight">{tab.label}</span>
                  </TabsTrigger>
                ))}
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
