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
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

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
  // Mobile: track which verse has actions expanded
  const [expandedVerse, setExpandedVerse] = useState<number | null>(null);

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

  // Render verse action buttons (shared between mobile & desktop)
  const renderVerseActions = (v: BibleVerse, inline: boolean) => {
    const isFav = isBookmarked(version, selectedBook, selectedChapter, v.number);
    const verseNote = chapterNotes.find(n => n.verse === v.number);
    const highlight = getHighlight(version, selectedBook, selectedChapter, v.number);
    const hlColor = highlight ? HIGHLIGHT_COLORS.find(c => c.value === highlight.color) : null;
    const verseRefs = getRefsForVerse(version, selectedBook, selectedChapter, v.number);

    const btnSize = isMobile ? 'h-9 w-9' : 'h-7 w-7';
    const iconSize = isMobile ? 'w-4 h-4' : 'w-3.5 h-3.5';

    return (
      <div className={`flex items-center gap-0.5 ${inline ? '' : 'flex-wrap justify-center gap-1 py-1'}`}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className={btnSize} title="Grifar">
              <Highlighter className={`${iconSize} ${hlColor ? hlColor.text : ''}`} />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" side={isMobile ? 'top' : 'left'}>
            <div className="flex gap-2 items-center">
              {HIGHLIGHT_COLORS.map(c => (
                <button
                  key={c.value}
                  className={`w-7 h-7 rounded-full ${c.dot} hover:scale-110 transition-transform ring-2 ${highlight?.color === c.value ? 'ring-foreground' : 'ring-transparent'}`}
                  onClick={() => {
                    addHighlight({ version, book_abbrev: selectedBook, chapter: selectedChapter, verse: v.number, color: c.value });
                    toast.success(`Grifado com ${c.label}`);
                  }}
                  title={c.label}
                />
              ))}
              {highlight && (
                <button
                  className="w-7 h-7 rounded-full border-2 border-destructive flex items-center justify-center hover:scale-110 transition-transform"
                  onClick={() => { removeHighlight(highlight.id); toast.success('Grifo removido'); }}
                  title="Remover grifo"
                >
                  <X className="w-3.5 h-3.5 text-destructive" />
                </button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button variant="ghost" size="icon" className={btnSize} onClick={() => handleToggleBookmark(v)} title={isFav ? 'Remover favorito' : 'Favoritar'}>
          {isFav ? <Star className={`${iconSize} fill-primary text-primary`} /> : <StarOff className={iconSize} />}
        </Button>
        <Button variant="ghost" size="icon" className={btnSize} onClick={() => handleCopyVerse(v)} title="Copiar">
          <Copy className={iconSize} />
        </Button>
        <Button variant="ghost" size="icon" className={btnSize} onClick={() => handleOpenNote(v.number)} title="Anotar">
          <StickyNote className={`${iconSize} ${verseNote ? 'text-primary' : ''}`} />
        </Button>
        <Button variant="ghost" size="icon" className={btnSize} onClick={() => { setCrossRefVerse(v.number); setCrossRefDialogOpen(true); }} title="Referências cruzadas">
          <Link2 className={`${iconSize} ${verseRefs.length > 0 ? 'text-primary' : ''}`} />
        </Button>
      </div>
    );
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header — stacks on mobile */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Bíblia</h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Leitura, pesquisa e anotações</p>
        </div>
        <Select value={version} onValueChange={handleVersionChange}>
          <SelectTrigger className="w-full sm:w-[260px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BIBLE_VERSIONS.map(v => (
              <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="leitura" className="space-y-3 md:space-y-4">
        <TabsList className="bg-secondary/50 w-full overflow-x-auto scrollbar-none flex">
          <TabsTrigger value="leitura" className="gap-1 flex-1 min-w-0 text-xs sm:text-sm">
            <BookOpen className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Leitura</span>
          </TabsTrigger>
          <TabsTrigger value="pesquisa" className="gap-1 flex-1 min-w-0 text-xs sm:text-sm">
            <Search className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Pesquisa</span>
          </TabsTrigger>
          <TabsTrigger value="favoritos" className="gap-1 flex-1 min-w-0 text-xs sm:text-sm">
            <Star className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Favoritos</span>
          </TabsTrigger>
          <TabsTrigger value="anotacoes" className="gap-1 flex-1 min-w-0 text-xs sm:text-sm">
            <StickyNote className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">Notas</span>
          </TabsTrigger>
        </TabsList>

        {/* LEITURA */}
        <TabsContent value="leitura">
          {!selectedBook ? (
            <div className="space-y-4 md:space-y-6">
              {loadingBooks ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div>
                    <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Antigo Testamento</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 md:gap-2">
                      {otBooks.map(b => (
                        <Button key={b.abbrev} variant="outline" size="sm"
                          className="h-9 md:h-8 text-xs px-1.5 truncate touch-target"
                          onClick={() => handleSelectBook(b.abbrev)}
                          title={b.namePt || b.name}
                        >
                          {b.namePt || b.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-base md:text-lg font-semibold mb-2 md:mb-3">Novo Testamento</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-1.5 md:gap-2">
                      {ntBooks.map(b => (
                        <Button key={b.abbrev} variant="outline" size="sm"
                          className="h-9 md:h-8 text-xs px-1.5 truncate touch-target"
                          onClick={() => handleSelectBook(b.abbrev)}
                          title={b.namePt || b.name}
                        >
                          {b.namePt || b.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-3 md:space-y-4">
              {/* Navigation — compact on mobile */}
              <div className="glass rounded-xl p-2.5 md:p-4 flex flex-wrap items-center gap-2 justify-between">
                <Button variant="ghost" size="sm" className="h-8 px-2 text-xs md:text-sm" onClick={() => setSelectedBook('')}>
                  <Book className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Livros</span>
                </Button>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={selectedChapter <= 1} onClick={() => handleChangeChapter(selectedChapter - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Select value={String(selectedChapter)} onValueChange={v => handleChangeChapter(Number(v))}>
                    <SelectTrigger className="w-[100px] sm:w-[140px] h-8 text-xs sm:text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: totalChapters }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1)}>Cap. {i + 1}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={selectedChapter >= totalChapters} onClick={() => handleChangeChapter(selectedChapter + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" className="h-8 px-2 text-xs md:text-sm" onClick={() => handleOpenNote(null)}>
                  <StickyNote className="w-4 h-4 mr-1" /> <span className="hidden sm:inline">Anotar</span>
                </Button>
              </div>

              {/* Book info */}
              {currentBookInfo && (
                <div className="text-center">
                  <h3 className="text-lg md:text-xl font-bold">
                    {currentBookInfo.namePt || currentBookInfo.name}
                  </h3>
                  {currentBookInfo.namePt && (
                    <p className="text-xs text-muted-foreground/70">{currentBookInfo.name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Capítulo {selectedChapter}</p>
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
                <ScrollArea className="h-[calc(100vh-320px)] md:h-[60vh]">
                  <div className="space-y-0.5 pr-2 md:pr-4">
                    {verses.map(v => {
                      const isFav = isBookmarked(version, selectedBook, selectedChapter, v.number);
                      const verseNote = chapterNotes.find(n => n.verse === v.number);
                      const highlight = getHighlight(version, selectedBook, selectedChapter, v.number);
                      const hlColor = highlight ? HIGHLIGHT_COLORS.find(c => c.value === highlight.color) : null;
                      const verseRefs = getRefsForVerse(version, selectedBook, selectedChapter, v.number);
                      const isExpanded = expandedVerse === v.number;

                      return (
                        <div key={v.number}>
                          <div
                            className={`flex gap-2 py-2 px-2 md:px-3 rounded-lg transition-colors group ${hlColor ? hlColor.bg : 'hover:bg-secondary/50'} ${isMobile && isExpanded ? 'bg-secondary/40' : ''}`}
                            onClick={isMobile ? () => setExpandedVerse(isExpanded ? null : v.number) : undefined}
                          >
                            <span className="text-xs font-bold text-primary mt-1 min-w-[20px] md:min-w-[24px]">{v.number}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm leading-relaxed ${version === 'aleppo' ? 'text-right font-serif' : ''} ${version === 'textusreceptus' ? 'font-serif' : ''}`} dir={version === 'aleppo' ? 'rtl' : 'ltr'}>{v.text}</p>
                              {v.translation && (
                                <p className="text-xs text-muted-foreground mt-1 italic leading-relaxed">{v.translation}</p>
                              )}
                            </div>
                            {/* Desktop: hover actions */}
                            {!isMobile && (
                              <div className="opacity-0 group-hover:opacity-100 flex items-start gap-0.5 transition-opacity shrink-0">
                                {renderVerseActions(v, true)}
                              </div>
                            )}
                          </div>

                          {/* Mobile: expanded action bar */}
                          {isMobile && isExpanded && (
                            <div className="flex justify-center bg-secondary/30 rounded-b-lg -mt-0.5 pb-1">
                              {renderVerseActions(v, false)}
                            </div>
                          )}

                          {verseNote && (
                            <div className="ml-7 md:ml-9 mb-1 flex items-start gap-2 text-xs bg-accent/50 rounded-lg p-2">
                              <StickyNote className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0 text-muted-foreground">
                                <ScriptureLinkText text={verseNote.note} onNavigate={handleNavigateToRef} />
                              </div>
                              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={(e) => { e.stopPropagation(); handleEditNote(verseNote); }}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0" onClick={(e) => { e.stopPropagation(); deleteNote(verseNote.id); toast.success('Anotação removida'); }}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          )}
                          {verseRefs.length > 0 && (
                            <div className="ml-7 md:ml-9 mb-1 flex flex-wrap items-center gap-1 text-xs">
                              <Link2 className="w-3 h-3 text-primary shrink-0" />
                              {verseRefs.map(ref => {
                                const isSource = ref.source_book_abbrev === selectedBook && ref.source_chapter === selectedChapter && ref.source_verse === v.number;
                                const tName = isSource ? ref.target_book_name : ref.source_book_name;
                                const tCh = isSource ? ref.target_chapter : ref.source_chapter;
                                const tV = isSource ? ref.target_verse : ref.source_verse;
                                const tAbbrev = isSource ? ref.target_book_abbrev : ref.source_book_abbrev;
                                return (
                                  <Button key={ref.id} variant="outline" size="sm" className="h-5 px-1.5 text-[10px]"
                                    onClick={(e) => { e.stopPropagation(); handleNavigateToRef(tAbbrev, tCh, tV); }}>
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
                <div className="glass rounded-xl p-3 md:p-4 space-y-2 md:space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-1.5">
                    <StickyNote className="w-4 h-4 text-primary" /> Anotações deste capítulo
                  </h4>
                  {chapterNotes.map(n => (
                    <div key={n.id} className="flex items-start gap-2 text-sm bg-secondary/30 rounded-lg p-2 md:p-3">
                      {n.verse && <Badge variant="secondary" className="shrink-0 text-xs">v.{n.verse}</Badge>}
                      <div className="flex-1 min-w-0"><ScriptureLinkText text={n.note} onNavigate={handleNavigateToRef} /></div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => handleEditNote(n)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive shrink-0" onClick={() => { deleteNote(n.id); toast.success('Anotação removida'); }}>
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
          <div className="space-y-3 md:space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="Pesquisar na Bíblia..."
                className="flex-1 bg-secondary/50 h-10"
              />
              <Button onClick={handleSearch} disabled={loadingSearch} className="h-10 px-3">
                {loadingSearch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                <span className="hidden sm:inline ml-1">Buscar</span>
              </Button>
            </div>

            {loadingSearch ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : searchResults.length > 0 ? (
              <ScrollArea className="h-[calc(100vh-280px)] md:h-[60vh]">
                <div className="space-y-2 pr-2 md:pr-4">
                  {searchResults.map((r, i) => (
                    <div key={i} className="glass rounded-lg p-3 md:p-4 space-y-1">
                      <Badge variant="secondary" className="text-xs">{r.book_name} {r.chapter}:{r.verse}</Badge>
                      <p className="text-sm leading-relaxed">{r.text}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : searchTerm && !loadingSearch ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum resultado encontrado</p>
            ) : null}
          </div>
        </TabsContent>

        {/* FAVORITOS */}
        <TabsContent value="favoritos">
          {bookmarks.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhum versículo favorito</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-240px)] md:h-[60vh]">
              <div className="space-y-2 pr-2 md:pr-4">
                {bookmarks.map(bm => (
                  <div key={bm.id} className="glass rounded-lg p-3 md:p-4 flex items-start gap-2 md:gap-3">
                    <Star className="w-4 h-4 fill-primary text-primary mt-1 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <Badge variant="secondary" className="text-xs">{bm.book_name} {bm.chapter}:{bm.verse}</Badge>
                      <p className="text-sm">{bm.verse_text}</p>
                      <p className="text-xs text-muted-foreground">{bm.version.toUpperCase()}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => { removeBookmark(bm.id); toast.success('Favorito removido'); }}>
                      <Trash2 className="w-4 h-4" />
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
              <StickyNote className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">Nenhuma anotação</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-240px)] md:h-[60vh]">
              <div className="space-y-2 pr-2 md:pr-4">
                {notes.map(n => (
                  <div key={n.id} className="glass rounded-lg p-3 md:p-4 flex items-start gap-2 md:gap-3">
                    <StickyNote className="w-4 h-4 text-primary mt-1 shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary" className="text-xs">{n.book_name} {n.chapter}{n.verse ? `:${n.verse}` : ''}</Badge>
                        <span className="text-xs text-muted-foreground">{n.version.toUpperCase()}</span>
                      </div>
                      <div className="text-sm"><ScriptureLinkText text={n.note} onNavigate={handleNavigateToRef} /></div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditNote(n)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { deleteNote(n.id); toast.success('Anotação removida'); }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Note Dialog */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-[calc(100vw-32px)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingNoteId ? 'Editar Anotação' : 'Nova Anotação'}</DialogTitle>
          </DialogHeader>
          {noteVerse && <p className="text-sm text-muted-foreground">Versículo {noteVerse}</p>}
          <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Escreva sua anotação..." rows={4} />
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)} className="w-full sm:w-auto">Cancelar</Button>
            <Button onClick={handleSaveNote} className="w-full sm:w-auto">Salvar</Button>
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
