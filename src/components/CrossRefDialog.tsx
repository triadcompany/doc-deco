import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Link2, Trash2, ChevronLeft, ChevronRight, BookOpen, Loader2, Search } from 'lucide-react';
import { CrossReference } from '@/hooks/use-cross-references';
import { toast } from 'sonner';

const GITHUB_BASE = 'https://raw.githubusercontent.com/maatheusgois/bible/main/versions/pt-br';

interface RawBook {
  id: string;
  name: string;
  chapters: string[][];
}

interface CrossRefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceVersion: string;
  sourceBookAbbrev: string;
  sourceBookName: string;
  sourceChapter: number;
  sourceVerse: number;
  existingRefs: CrossReference[];
  onAdd: (ref: Omit<CrossReference, 'id' | 'created_at'>) => void;
  onDelete: (id: string) => void;
  onNavigate: (bookAbbrev: string, chapter: number, verse: number) => void;
}

type PickerStep = 'list' | 'book' | 'chapter' | 'preview';

const bibleCache: Record<string, RawBook[]> = {};

export function CrossRefDialog({
  open, onOpenChange,
  sourceVersion, sourceBookAbbrev, sourceBookName, sourceChapter, sourceVerse,
  existingRefs, onAdd, onDelete, onNavigate,
}: CrossRefDialogProps) {
  const [step, setStep] = useState<PickerStep>('list');
  const [bibleData, setBibleData] = useState<RawBook[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedBook, setPickedBook] = useState<RawBook | null>(null);
  const [pickedChapter, setPickedChapter] = useState(1);
  const [pickedVerse, setPickedVerse] = useState(1);
  const [noteInput, setNoteInput] = useState('');
  const [bookFilter, setBookFilter] = useState('');

  // Load ARC bible data for the picker (always use ARC for navigation)
  useEffect(() => {
    if (!open) return;
    if (bibleCache['arc']) {
      setBibleData(bibleCache['arc']);
      return;
    }
    setLoading(true);
    fetch(`${GITHUB_BASE}/arc.json`)
      .then(r => r.json())
      .then((data: RawBook[]) => {
        bibleCache['arc'] = data;
        setBibleData(data);
      })
      .catch(() => toast.error('Erro ao carregar dados da Bíblia'))
      .finally(() => setLoading(false));
  }, [open]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('list');
      setPickedBook(null);
      setPickedChapter(1);
      setPickedVerse(1);
      setNoteInput('');
      setBookFilter('');
    }
  }, [open]);

  const handleSelectBook = (book: RawBook) => {
    setPickedBook(book);
    setPickedChapter(1);
    setStep('chapter');
  };

  const handleSelectChapter = (ch: number) => {
    setPickedChapter(ch);
    setPickedVerse(1);
    setStep('preview');
  };

  const handleConfirm = () => {
    if (!pickedBook) return;
    onAdd({
      source_version: sourceVersion,
      source_book_abbrev: sourceBookAbbrev,
      source_book_name: sourceBookName,
      source_chapter: sourceChapter,
      source_verse: sourceVerse,
      target_version: 'arc',
      target_book_abbrev: pickedBook.id,
      target_book_name: pickedBook.name,
      target_chapter: pickedChapter,
      target_verse: pickedVerse,
      note: noteInput.trim(),
    });
    setStep('list');
    setNoteInput('');
    toast.success('Referência cruzada adicionada!');
  };

  const currentChapterVerses = pickedBook && pickedChapter > 0 && pickedChapter <= pickedBook.chapters.length
    ? pickedBook.chapters[pickedChapter - 1]
    : [];

  const otBooks = bibleData.filter((_, i) => i < 39);
  const ntBooks = bibleData.filter((_, i) => i >= 39);

  const filteredOt = bookFilter
    ? otBooks.filter(b => b.name.toLowerCase().includes(bookFilter.toLowerCase()))
    : otBooks;
  const filteredNt = bookFilter
    ? ntBooks.filter(b => b.name.toLowerCase().includes(bookFilter.toLowerCase()))
    : ntBooks;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            Referências Cruzadas
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          {sourceBookName} {sourceChapter}:{sourceVerse}
        </p>

        {/* Existing refs */}
        {step === 'list' && existingRefs.length > 0 && (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {existingRefs.map(ref => {
              const isSource = ref.source_book_abbrev === sourceBookAbbrev &&
                ref.source_chapter === sourceChapter && ref.source_verse === sourceVerse;
              const targetName = isSource ? ref.target_book_name : ref.source_book_name;
              const targetCh = isSource ? ref.target_chapter : ref.source_chapter;
              const targetV = isSource ? ref.target_verse : ref.source_verse;
              const targetAbbrev = isSource ? ref.target_book_abbrev : ref.source_book_abbrev;

              return (
                <div key={ref.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                  <Link2 className="w-3 h-3 text-primary shrink-0" />
                  <Button
                    variant="link"
                    className="h-auto p-0 text-sm font-medium"
                    onClick={() => { onNavigate(targetAbbrev, targetCh, targetV); onOpenChange(false); }}
                  >
                    {targetName} {targetCh}:{targetV}
                  </Button>
                  {ref.note && <span className="text-xs text-muted-foreground flex-1 truncate">— {ref.note}</span>}
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive shrink-0"
                    onClick={() => { onDelete(ref.id); toast.success('Referência removida'); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Step: list → pick a book */}
        {step === 'list' && (
          <div className="flex-1 min-h-0">
            <Button variant="default" size="sm" className="mb-3 w-full" onClick={() => setStep('book')}>
              <BookOpen className="w-4 h-4 mr-1" /> Adicionar nova conexão
            </Button>
          </div>
        )}

        {step === 'book' && (
          <div className="flex-1 min-h-0 space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('list')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <span className="text-sm font-medium">Escolha o livro</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={bookFilter}
                onChange={e => setBookFilter(e.target.value)}
                placeholder="Filtrar livros..."
                className="pl-7 h-8 text-sm bg-secondary/50"
              />
            </div>
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : (
              <ScrollArea className="h-[300px]">
                <div className="space-y-3 pr-2">
                  {filteredOt.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Antigo Testamento</p>
                      <div className="flex flex-wrap gap-1">
                        {filteredOt.map(b => (
                          <Button key={b.id} variant="outline" size="sm" className="h-7 text-xs px-2"
                            onClick={() => handleSelectBook(b)}>
                            {b.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {filteredNt.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Novo Testamento</p>
                      <div className="flex flex-wrap gap-1">
                        {filteredNt.map(b => (
                          <Button key={b.id} variant="outline" size="sm" className="h-7 text-xs px-2"
                            onClick={() => handleSelectBook(b)}>
                            {b.name}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>
        )}

        {/* Step: chapter */}
        {step === 'chapter' && pickedBook && (
          <div className="flex-1 min-h-0 space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('book')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <span className="text-sm font-medium">{pickedBook.name} — Escolha o capítulo</span>
            </div>
            <ScrollArea className="h-[280px]">
              <div className="flex flex-wrap gap-1.5 pr-2">
                {Array.from({ length: pickedBook.chapters.length }, (_, i) => (
                  <Button key={i + 1} variant="outline" size="sm" className="h-8 w-10 text-xs"
                    onClick={() => handleSelectChapter(i + 1)}>
                    {i + 1}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Step: preview — read & pick verse */}
        {step === 'preview' && pickedBook && (
          <div className="flex-1 min-h-0 space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setStep('chapter')}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
              </Button>
              <span className="text-sm font-medium">{pickedBook.name} {pickedChapter}</span>
            </div>
            <p className="text-xs text-muted-foreground">Toque no versículo para selecionar</p>
            <ScrollArea className="h-[220px]">
              <div className="space-y-0.5 pr-2">
                {currentChapterVerses.map((text, i) => {
                  const vNum = i + 1;
                  const isSelected = pickedVerse === vNum;
                  return (
                    <button
                      key={vNum}
                      className={`w-full text-left flex gap-2 py-1.5 px-2 rounded-md transition-colors text-sm ${
                        isSelected ? 'bg-primary/15 ring-1 ring-primary' : 'hover:bg-secondary/50'
                      }`}
                      onClick={() => setPickedVerse(vNum)}
                    >
                      <span className="text-xs font-bold text-primary mt-0.5 min-w-[20px]">{vNum}</span>
                      <span className="flex-1 leading-relaxed">{text.trim()}</span>
                    </button>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Selected verse preview & note */}
            <div className="rounded-lg bg-secondary/30 p-2.5 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {pickedBook.name} {pickedChapter}:{pickedVerse}
                </Badge>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {currentChapterVerses[pickedVerse - 1]?.trim() || '—'}
              </p>
              <Textarea
                value={noteInput}
                onChange={e => setNoteInput(e.target.value)}
                placeholder="Nota sobre a conexão (opcional)"
                rows={2}
                className="text-xs"
              />
              <Button size="sm" className="w-full" onClick={handleConfirm}>
                <Link2 className="w-3.5 h-3.5 mr-1" /> Conectar {pickedBook.name} {pickedChapter}:{pickedVerse}
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
