import { useState, useMemo } from 'react';
import { PDFDocument } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useDocuments } from '@/hooks/use-documents';
import { PDFViewer } from '@/components/PDFViewer';
import { UploadDialog } from '@/components/UploadDialog';
import { EditDocumentDialog } from '@/components/EditDocumentDialog';
import { DocumentsTab } from '@/components/DocumentsTab';
import { SearchTab } from '@/components/SearchTab';
import { FoldersTab } from '@/components/FoldersTab';
import { FavoritesTab } from '@/components/FavoritesTab';
import { SettingsTab } from '@/components/SettingsTab';
import { MetaTab } from '@/components/MetaTab';
import { BibleTab } from '@/components/BibleTab';
import { CurrentReadings } from '@/components/CurrentReadings';
import { useSettings } from '@/hooks/use-settings';
import { useReadingGoals } from '@/hooks/use-reading-goals';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Upload,
  BookOpen,
  Star,
  SlidersHorizontal,
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
  const { documents, loading, fetchDocuments, uploadDocument, toggleFavorite, deleteDocument, updateDocument } = useDocuments();
  const { signOut } = useAuth();
  const { authors, translators, addAuthor, removeAuthor, addTranslator, removeTranslator } = useSettings();
  const { goal, currentReadings, completedThisMonth, upsertGoal, markCompleted, removeReading } = useReadingGoals();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<PDFDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<PDFDocument | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    documents.forEach((d) => d.tags.forEach((t) => tags.add(t)));
    return Array.from(tags);
  }, [documents]);

  if (viewingDoc) {
    return <PDFViewer doc={viewingDoc} onBack={() => setViewingDoc(null)} />;
  }

  return (
    <div className="min-h-screen bg-background safe-top safe-bottom safe-x">
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
          <Tabs defaultValue="inicio" className="space-y-4 sm:space-y-6">
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
              <TabsList className="bg-secondary/50 w-max sm:w-auto">
                <TabsTrigger value="inicio" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Início</span>
                </TabsTrigger>
                <TabsTrigger value="documentos" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                  <FolderSearch className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Documentos</span>
                </TabsTrigger>
                <TabsTrigger value="pastas" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                  <FolderTree className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pastas</span>
                </TabsTrigger>
                <TabsTrigger value="favoritos" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                  <Star className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Favoritos</span>
                </TabsTrigger>
                <TabsTrigger value="pesquisa" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                  <Search className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Pesquisa</span>
                </TabsTrigger>
                <TabsTrigger value="meta" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                  <Target className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Meta</span>
                </TabsTrigger>
                <TabsTrigger value="biblia" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                  <BookOpen className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Bíblia</span>
                </TabsTrigger>
                <TabsTrigger value="configuracoes" className="gap-1 sm:gap-1.5 text-xs sm:text-sm px-2.5 sm:px-3">
                  <Settings className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Config</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="inicio">
              {/* Stats */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                {[
                  { label: 'Total de PDFs', value: documents.length, icon: FileText },
                  { label: 'Favoritos', value: documents.filter((d) => d.favorite).length, icon: Star },
                  { label: 'Tags', value: allTags.length, icon: SlidersHorizontal },
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

              {/* Current Readings */}
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                Leituras Atuais
              </h2>
              {currentReadings.length > 0 ? (
                <CurrentReadings
                  documents={documents}
                  currentReadings={currentReadings}
                  onView={setViewingDoc}
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
            </TabsContent>

            <TabsContent value="documentos">
              <DocumentsTab
                documents={documents}
                onView={setViewingDoc}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteDocument}
                onEdit={setEditingDoc}
              />
            </TabsContent>

            <TabsContent value="pastas">
              <FoldersTab
                documents={documents}
                onView={setViewingDoc}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteDocument}
                onEdit={setEditingDoc}
              />
            </TabsContent>

            <TabsContent value="favoritos">
              <FavoritesTab
                documents={documents}
                onView={setViewingDoc}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteDocument}
                onEdit={setEditingDoc}
              />
            </TabsContent>

            <TabsContent value="pesquisa">
              <SearchTab
                documents={documents}
                onView={setViewingDoc}
                onToggleFavorite={toggleFavorite}
                onDelete={deleteDocument}
                authorsList={authors.map((a) => a.name)}
                translatorsList={translators.map((t) => t.name)}
              />
            </TabsContent>

            <TabsContent value="meta">
              <MetaTab
                documents={documents}
                completedThisMonth={completedThisMonth}
                goal={goal}
                upsertGoal={upsertGoal}
              />
            </TabsContent>

            <TabsContent value="biblia">
              <BibleTab />
            </TabsContent>

            <TabsContent value="configuracoes">
              <SettingsTab
                authors={authors}
                translators={translators}
                addAuthor={addAuthor}
                removeAuthor={removeAuthor}
                addTranslator={addTranslator}
                removeTranslator={removeTranslator}
              />
            </TabsContent>
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
  );
};

export default Index;
