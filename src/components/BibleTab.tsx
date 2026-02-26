import { useState, useMemo } from 'react';
import { useBible, BIBLE_VERSIONS, HIGHLIGHT_COLORS, BibleVerse } from '@/hooks/use-bible';
import { useCrossReferences } from '@/hooks/use-cross-references';
import { ScriptureLinkText } from '@/components/ScriptureLinkText';
import { CrossRefDialog } from '@/components/CrossRefDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Book,
  Search,
  Star,
  StarOff,
  StickyNote,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  Copy,
  Trash2,
  Pencil,
  Highlighter,
  X,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';

export function BibleTab() {
  const {
    books, loadingBooks,
    verses, loadingVerses, currentBookInfo, fetchError,
    fetchChapter, fetchBooks,
    searchResults, loadingSearch, searchVerses,
    bookmarks, addBookmark, removeBookmark, isBookmarked,
    notes, addNote, updateNote, deleteNote,
    highlights, addHighlight, removeHighlight, getHighlight,
  } = useBible();

  const { crossRefs, addCrossRef, deleteCrossRef, getRefsForVerse } = useCrossReferences();

  const [version, setVersion] = useState('arc');
  const [selectedBook, setSelectedBook] = useState('');
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteVerse, setNoteVerse] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [crossRefDialogOpen, setCrossRefDialogOpen] = useState(false);
  const [crossRefVerse, setCrossRefVerse] = useState<number>(1);

  // Navigate to a scripture reference (used by cross-refs and clickable links)
  const handleNavigateToRef = (bookAbbrev: string, chapter: number, _verse: number) => {
    setSelectedBook(bookAbbrev);
    setSelectedChapter(chapter);
    fetchChapter(version, bookAbbrev, chapter);
  };

  const currentBook = useMemo(() => books.find(b => b.abbrev === selectedBook), [books, selectedBook]);
  const totalChapters = currentBook?.chapters || 0;

  const otBooks = useMemo(() => books.filter(b => b.testament === 'VT'), [books]);
  const ntBooks = useMemo(() => books.filter(b => b.testament === 'NT'), [books]);

  const handleSelectBook = (abbrev: string) => {
    setSelectedBook(abbrev);
    setSelectedChapter(1);
    fetchChapter(version, abbrev, 1);
  };

  const handleChangeChapter = (ch: number) => {
    setSelectedChapter(ch);
    fetchChapter(version, selectedBook, ch);
  };

  const handleVersionChange = (v: string) => {
    setVersion(v);
    setSelectedBook('');
    fetchBooks(v);
  };

  const handleSearch = () => {
    if (searchTerm.trim()) searchVerses(version, searchTerm);
  };

  const handleToggleBookmark = (verse: BibleVerse) => {
    if (!currentBook) return;
    const bm = isBookmarked(version, selectedBook, selectedChapter, verse.number);
    if (bm) {
      const found = bookmarks.find(b => b.version === version && b.book_abbrev === selectedBook && b.chapter === selectedChapter && b.verse === verse.number);
      if (found) removeBookmark(found.id);
    } else {
      addBookmark({
        version,
        book_abbrev: selectedBook,
        book_name: currentBook.name,
        chapter: selectedChapter,
        verse: verse.number,
        verse_text: verse.text,
      });
      toast.success('Versículo marcado!');
    }
  };

  const handleCopyVerse = (verse: BibleVerse) => {
    const ref = currentBook ? `${currentBook.name} ${selectedChapter}:${verse.number}` : '';
    navigator.clipboard.writeText(`"${verse.text}" — ${ref} (${version.toUpperCase()})`);
    toast.success('Versículo copiado!');
  };

  const handleOpenNote = (verseNum: number | null = null) => {
    setNoteVerse(verseNum);
    setNoteText('');
    setEditingNoteId(null);
    setNoteDialogOpen(true);
  };

  const handleEditNote = (note: typeof notes[0]) => {
    setEditingNoteId(note.id);
    setNoteText(note.note);
    setNoteVerse(note.verse);
    setNoteDialogOpen(true);
  };

  const handleSaveNote = () => {
    if (!noteText.trim()) { toast.error('Digite uma anotação'); return; }
    if (editingNoteId) {
      updateNote(editingNoteId, noteText);
      toast.success('Anotação atualizada!');
    } else {
      if (!currentBook) return;
      addNote({
        version,
        book_abbrev: selectedBook,
        book_name: currentBook.name,
        chapter: selectedChapter,
        verse: noteVerse,
        note: noteText,
      });
      toast.success('Anotação salva!');
    }
    setNoteDialogOpen(false);
  };

  const chapterNotes = useMemo(() =>
    notes.filter(n => n.book_abbrev === selectedBook && n.chapter === selectedChapter && n.version === version),
    [notes, selectedBook, selectedChapter, version]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Bíblia</h2>
          <p className="text-sm text-muted-foreground mt-1">Leitura, pesquisa e anotações</p>
        </div>
        <Select value={version} onValueChange={handleVersionChange}>
          <SelectTrigger className="w-[280px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BIBLE_VERSIONS.map(v => (
              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="leitura" className="space-y-4">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="leitura" className="gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Leitura
          </TabsTrigger>
          <TabsTrigger value="pesquisa" className="gap-1.5">
            <Search className="w-3.5 h-3.5" /> Pesquisa
          </TabsTrigger>
          <TabsTrigger value="favoritos" className="gap-1.5">
            <Star className="w-3.5 h-3.5" /> Favoritos
          </TabsTrigger>
          <TabsTrigger value="anotacoes" className="gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Anotações
          </TabsTrigger>
        </TabsList>

        {/* LEITURA */}
        <TabsContent value="leitura">
          {!selectedBook ? (
            <div className="space-y-6">
              {loadingBooks ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Antigo Testamento</h3>
                    <div className="flex flex-wrap gap-2">
                      {otBooks.map(b => (
                        <Button key={b.abbrev} variant="outline" size="sm" onClick={() => handleSelectBook(b.abbrev)} title={b.namePt || b.name}>
                          {b.namePt ? `${b.namePt}` : b.name}
                          {b.namePt && <span className="ml-1 text-[10px] text-muted-foreground">({b.name})</span>}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Novo Testamento</h3>
                    <div className="flex flex-wrap gap-2">
                      {ntBooks.map(b => (
                        <Button key={b.abbrev} variant="outline" size="sm" onClick={() => handleSelectBook(b.abbrev)} title={b.namePt || b.name}>
                          {b.namePt ? `${b.namePt}` : b.name}
                          {b.namePt && <span className="ml-1 text-[10px] text-muted-foreground">({b.name})</span>}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Navigation */}
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setSelectedBook('')}>
                  <Book className="w-4 h-4 mr-1" /> Livros
                </Button>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={selectedChapter <= 1} onClick={() => handleChangeChapter(selectedChapter - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Select value={String(selectedChapter)} onValueChange={v => handleChangeChapter(Number(v))}>
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: totalChapters }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>Capítulo {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={selectedChapter >= totalChapters} onClick={() => handleChangeChapter(selectedChapter + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleOpenNote(null)}>
                  <StickyNote className="w-4 h-4 mr-1" /> Anotar
                </Button>
              </div>

              {/* Book info */}
              {currentBookInfo && (
                <div className="text-center">
                  <h3 className="text-xl font-bold">
                    {currentBookInfo.namePt || currentBookInfo.name}
                  </h3>
                  {currentBookInfo.namePt && (
                    <p className="text-sm text-muted-foreground/70">{currentBookInfo.name}</p>
                  )}
                  <p className="text-sm text-muted-foreground">Capítulo {selectedChapter}</p>
                </div>
              )}

              {/* Error */}
              {fetchError && !loadingVerses && (
                <div className="text-center py-8">
                  <p className="text-destructive text-sm">{fetchError}</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setSelectedBook('')}>
                    Voltar aos livros
                  </Button>
                </div>
              )}

              {/* Verses */}
              {loadingVerses ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : verses.length > 0 ? (
                <ScrollArea className="h-[60vh]">
                  <div className="space-y-1 pr-4">
                    {verses.map(v => {
                      const isFav = isBookmarked(version, selectedBook, selectedChapter, v.number);
                      const verseNote = chapterNotes.find(n => n.verse === v.number);
                      const highlight = getHighlight(version, selectedBook, selectedChapter, v.number);
                      const hlColor = highlight ? HIGHLIGHT_COLORS.find(c => c.value === highlight.color) : null;
                      const verseRefs = getRefsForVerse(version, selectedBook, selectedChapter, v.number);
                      return (
                        <div key={v.number} className="group">
                          <div className={`flex gap-2 py-2 px-3 rounded-lg transition-colors ${hlColor ? hlColor.bg : 'hover:bg-secondary/50'}`}>
                            <span className="text-xs font-bold text-primary mt-1 min-w-[24px]">{v.number}</span>
                            <div className="flex-1">
                              <p className={`text-sm leading-relaxed ${version === 'aleppo' ? 'text-right font-serif' : ''} ${version === 'textusreceptus' ? 'font-serif' : ''}`} dir={version === 'aleppo' ? 'rtl' : 'ltr'}>{v.text}</p>
                              {v.translation && (
                                <p className="text-xs text-muted-foreground mt-1 italic leading-relaxed">{v.translation}</p>
                              )}
                            </div>
                            <div className="opacity-0 group-hover:opacity-100 flex items-start gap-1 transition-opacity">
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Grifar">
                                    <Highlighter className={`w-3.5 h-3.5 ${hlColor ? hlColor.text : ''}`} />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2" side="left">
                                  <div className="flex gap-1.5 items-center">
                                    {HIGHLIGHT_COLORS.map(c => (
                                      <button
                                        key={c.value}
                                        className={`w-6 h-6 rounded-full ${c.dot} hover:scale-110 transition-transform ring-2 ${highlight?.color === c.value ? 'ring-foreground' : 'ring-transparent'}`}
                                        onClick={() => {
                                          addHighlight({ version, book_abbrev: selectedBook, chapter: selectedChapter, verse: v.number, color: c.value });
                                          toast.success(`Grifado com ${c.label}`);
                                        }}
                                        title={c.label}
                                      />
                                    ))}
                                    {highlight && (
                                      <button
                                        className="w-6 h-6 rounded-full border-2 border-destructive flex items-center justify-center hover:scale-110 transition-transform"
                                        onClick={() => { removeHighlight(highlight.id); toast.success('Grifo removido'); }}
                                        title="Remover grifo"
                                      >
                                        <X className="w-3 h-3 text-destructive" />
                                      </button>
                                    )}
                                  </div>
                                </PopoverContent>
                              </Popover>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleBookmark(v)} title={isFav ? 'Remover favorito' : 'Favoritar'}>
                                {isFav ? <Star className="w-3.5 h-3.5 fill-primary text-primary" /> : <StarOff className="w-3.5 h-3.5" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyVerse(v)} title="Copiar">
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenNote(v.number)} title="Anotar">
                                <StickyNote className={`w-3.5 h-3.5 ${verseNote ? 'text-primary' : ''}`} />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCrossRefVerse(v.number); setCrossRefDialogOpen(true); }} title="Referências cruzadas">
                                <Link2 className={`w-3.5 h-3.5 ${verseRefs.length > 0 ? 'text-primary' : ''}`} />
                              </Button>
                            </div>
                          </div>
                          {verseNote && (
                            <div className="ml-9 mb-2 flex items-start gap-2 text-xs bg-accent/50 rounded-lg p-2">
                              <StickyNote className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                              <div className="flex-1 text-muted-foreground">
                                <ScriptureLinkText text={verseNote.note} onNavigate={handleNavigateToRef} />
                              </div>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleEditNote(verseNote)}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => { deleteNote(verseNote.id); toast.success('Anotação removida'); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {verseRefs.length > 0 && (
                            <div className="ml-9 mb-2 flex flex-wrap items-center gap-1.5 text-xs">
                              <Link2 className="w-3 h-3 text-primary shrink-0" />
                              {verseRefs.map(ref => {
                                const isSource = ref.source_book_abbrev === selectedBook && ref.source_chapter === selectedChapter && ref.source_verse === v.number;
                                const tName = isSource ? ref.target_book_name : ref.source_book_name;
                                const tCh = isSource ? ref.target_chapter : ref.source_chapter;
                                const tV = isSource ? ref.target_verse : ref.source_verse;
                                const tAbbrev = isSource ? ref.target_book_abbrev : ref.source_book_abbrev;
                                return (
                                  <Button key={ref.id} variant="outline" size="sm" className="h-5 px-1.5 text-[10px]"
                                    onClick={() => handleNavigateToRef(tAbbrev, tCh, tV)}>
                                    {tName} {tCh}:{tV}
                                  </Button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              ) : null}

              {/* Chapter notes */}
              {chapterNotes.length > 0 && (
                <div className="glass rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <StickyNote className="w-4 h-4 text-primary" /> Anotações deste capítulo
                  </h4>
                  {chapterNotes.map(n => (
                    <div key={n.id} className="flex items-start gap-2 text-sm bg-secondary/30 rounded-lg p-3">
                      {n.verse && <Badge variant="secondary" className="shrink-0">v.{n.verse}</Badge>}
                      <div className="flex-1"><ScriptureLinkText text={n.note} onNavigate={handleNavigateToRef} /></div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditNote(n)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { deleteNote(n.id); toast.success('Anotação removida'); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* PESQUISA */}
        <TabsContent value="pesquisa">
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Pesquisar na Bíblia..."
                className="flex-1 bg-secondary/50"
              />
              <Button onClick={handleSearch} disabled={loadingSearch}>
                {loadingSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </Button>
            </div>

            {loadingSearch ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : searchResults.length > 0 ? (
              <ScrollArea className="h-[60vh]">
                <div className="space-y-2 pr-4">
                  {searchResults.map((r, i) => (
                    <div key={i} className="glass rounded-lg p-4 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{r.book_name} {r.chapter}:{r.verse}</Badge>
                      </div>
                      <p className="text-sm leading-relaxed">{r.text}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : searchTerm && !loadingSearch ? (
              <p className="text-center text-muted-foreground py-8">Nenhum resultado encontrado</p>
            ) : null}
          </div>
        </TabsContent>

        {/* FAVORITOS */}
        <TabsContent value="favoritos">
          {bookmarks.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhum versículo favorito</p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-2 pr-4">
                {bookmarks.map(bm => (
                  <div key={bm.id} className="glass rounded-lg p-4 flex items-start gap-3">
                    <Star className="w-4 h-4 fill-primary text-primary mt-1 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <Badge variant="secondary">{bm.book_name} {bm.chapter}:{bm.verse}</Badge>
                      <p className="text-sm">{bm.verse_text}</p>
                      <p className="text-xs text-muted-foreground">{bm.version.toUpperCase()}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { removeBookmark(bm.id); toast.success('Favorito removido'); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* ANOTAÇÕES */}
        <TabsContent value="anotacoes">
          {notes.length === 0 ? (
            <div className="text-center py-12">
              <StickyNote className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">Nenhuma anotação</p>
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-2 pr-4">
                {notes.map(n => (
                  <div key={n.id} className="glass rounded-lg p-4 flex items-start gap-3">
                    <StickyNote className="w-4 h-4 text-primary mt-1 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{n.book_name} {n.chapter}{n.verse ? `:${n.verse}` : ''}</Badge>
                        <span className="text-xs text-muted-foreground">{n.version.toUpperCase()}</span>
                      </div>
                      <div className="text-sm"><ScriptureLinkText text={n.note} onNavigate={handleNavigateToRef} /></div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditNote(n)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { deleteNote(n.id); toast.success('Anotação removida'); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingNoteId ? 'Editar Anotação' : 'Nova Anotação'}</DialogTitle>
          </DialogHeader>
          {noteVerse && <p className="text-sm text-muted-foreground">Versículo {noteVerse}</p>}
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escreva sua anotação..." rows={4} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNote}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cross Reference Dialog */}
      <CrossRefDialog
        open={crossRefDialogOpen}
        onOpenChange={setCrossRefDialogOpen}
        sourceVersion={version}
        sourceBookAbbrev={selectedBook}
        sourceBookName={currentBookInfo?.namePt || currentBookInfo?.name || ''}
        sourceChapter={selectedChapter}
        sourceVerse={crossRefVerse}
        existingRefs={getRefsForVerse(version, selectedBook, selectedChapter, crossRefVerse)}
        onAdd={addCrossRef}
        onDelete={deleteCrossRef}
        onNavigate={handleNavigateToRef}
      />
    </div>
  );
}
