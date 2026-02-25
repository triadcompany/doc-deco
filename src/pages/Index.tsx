import { useState, useMemo } from 'react';
import { PDFDocument, ViewMode, SortBy } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';
import { useDocuments } from '@/hooks/use-documents';
import { PDFCard } from '@/components/PDFCard';
import { PDFViewer } from '@/components/PDFViewer';
import { UploadDialog } from '@/components/UploadDialog';
import { EditDocumentDialog } from '@/components/EditDocumentDialog';
import { DocumentsTab } from '@/components/DocumentsTab';
import { SearchTab } from '@/components/SearchTab';
import { FoldersTab } from '@/components/FoldersTab';
import { SettingsTab } from '@/components/SettingsTab';
import { MetaTab } from '@/components/MetaTab';
import { CurrentReadings } from '@/components/CurrentReadings';
import { useSettings } from '@/hooks/use-settings';
import { useReadingGoals } from '@/hooks/use-reading-goals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  Search,
  LayoutGrid,
  List,
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
} from 'lucide-react';

const Index = () => {
  const { documents, loading, fetchDocuments, uploadDocument, toggleFavorite, deleteDocument, updateDocument } = useDocuments();
  const { signOut } = useAuth();
  const { authors, translators, addAuthor, removeAuthor, addTranslator, removeTranslator } = useSettings();
  const { goal, currentReadings, completedThisMonth, upsertGoal, markCompleted, removeReading } = useReadingGoals();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('createdAt');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<PDFDocument | null>(null);
  const [editingDoc, setEditingDoc] = useState<PDFDocument | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    documents.forEach((d) => d.tags.forEach((t) => tags.add(t)));
    return Array.from(tags);
  }, [documents]);

  const filteredDocs = useMemo(() => {
    let docs = [...documents];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.author.toLowerCase().includes(q) ||
          d.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filterFavorites) docs = docs.filter((d) => d.favorite);
    if (selectedTag) docs = docs.filter((d) => d.tags.includes(selectedTag));
    docs.sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'author') return a.author.localeCompare(b.author);
      if (sortBy === 'date') return b.date.localeCompare(a.date);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return docs;
  }, [documents, searchQuery, sortBy, filterFavorites, selectedTag]);

  if (viewingDoc) {
    return <PDFViewer doc={viewingDoc} onBack={() => setViewingDoc(null)} />;
  }

  return (
    <div className="min-h-screen bg-background dark">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center glow-amber">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">DocVault</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Biblioteca Digital</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar documentos..."
                className="pl-9 w-64 h-9 bg-secondary/50"
              />
            </div>
            <Button onClick={() => setUploadOpen(true)} className="glow-amber">
              <Upload className="w-4 h-4" />
              Upload
            </Button>
            <Button variant="ghost" size="icon" onClick={() => signOut()} title="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="inicio" className="space-y-6">
            <TabsList className="bg-secondary/50">
              <TabsTrigger value="inicio" className="gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                Início
              </TabsTrigger>
              <TabsTrigger value="documentos" className="gap-1.5">
                <FolderSearch className="w-3.5 h-3.5" />
                Documentos
              </TabsTrigger>
              <TabsTrigger value="pastas" className="gap-1.5">
                <FolderTree className="w-3.5 h-3.5" />
                Pastas
              </TabsTrigger>
              <TabsTrigger value="pesquisa" className="gap-1.5">
                <Search className="w-3.5 h-3.5" />
                Pesquisa
              </TabsTrigger>
              <TabsTrigger value="meta" className="gap-1.5">
                <Target className="w-3.5 h-3.5" />
                Meta
              </TabsTrigger>
              <TabsTrigger value="configuracoes" className="gap-1.5">
                <Settings className="w-3.5 h-3.5" />
                Configurações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inicio">
              {/* Current Readings */}
              {currentReadings.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    Leituras Atuais
                  </h2>
                  <CurrentReadings
                    documents={documents}
                    currentReadings={currentReadings}
                    onView={setViewingDoc}
                    onMarkCompleted={markCompleted}
                    onRemove={removeReading}
                  />
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: 'Total de PDFs', value: documents.length, icon: FileText },
                  { label: 'Favoritos', value: documents.filter((d) => d.favorite).length, icon: Star },
                  { label: 'Tags', value: allTags.length, icon: SlidersHorizontal },
                ].map((stat) => (
                  <div key={stat.label} className="glass rounded-xl p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <stat.icon className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stat.value}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant={filterFavorites ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterFavorites(!filterFavorites)}
                  >
                    <Star className={`w-3.5 h-3.5 ${filterFavorites ? 'fill-current' : ''}`} />
                    Favoritos
                  </Button>
                  {allTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant={selectedTag === tag ? 'default' : 'secondary'}
                      className="cursor-pointer"
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="createdAt">Mais recente</SelectItem>
                      <SelectItem value="title">Título</SelectItem>
                      <SelectItem value="author">Autor</SelectItem>
                      <SelectItem value="date">Data</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex border border-border rounded-md">
                    <Button
                      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-9 w-9 rounded-r-none"
                      onClick={() => setViewMode('grid')}
                    >
                      <LayoutGrid className="w-4 h-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-9 w-9 rounded-l-none"
                      onClick={() => setViewMode('list')}
                    >
                      <List className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Documents */}
              {filteredDocs.length === 0 ? (
                <div className="text-center py-20">
                  <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <p className="text-lg font-medium text-muted-foreground">Nenhum documento encontrado</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Faça upload de PDFs para começar</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredDocs.map((doc) => (
                    <PDFCard
                      key={doc.id}
                      doc={doc}
                      viewMode="grid"
                      onView={setViewingDoc}
                      onToggleFavorite={toggleFavorite}
                      onDelete={deleteDocument}
                      onEdit={setEditingDoc}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredDocs.map((doc) => (
                    <PDFCard
                      key={doc.id}
                      doc={doc}
                      viewMode="list"
                      onView={setViewingDoc}
                      onToggleFavorite={toggleFavorite}
                      onDelete={deleteDocument}
                      onEdit={setEditingDoc}
                    />
                  ))}
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
