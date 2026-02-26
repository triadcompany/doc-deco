import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Link2, Trash2 } from 'lucide-react';
import { CrossReference } from '@/hooks/use-cross-references';
import { toast } from 'sonner';

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

export function CrossRefDialog({
  open, onOpenChange,
  sourceVersion, sourceBookAbbrev, sourceBookName, sourceChapter, sourceVerse,
  existingRefs, onAdd, onDelete, onNavigate,
}: CrossRefDialogProps) {
  const [refInput, setRefInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  const handleAdd = () => {
    // Parse simple format: "Jo 3:16" or "Rm 8:28"
    const match = refInput.trim().match(/^(.+?)\s+(\d+):(\d+)$/);
    if (!match) {
      toast.error('Formato inválido. Use: "Jo 3:16"');
      return;
    }

    const bookInput = match[1].trim();
    const chapter = parseInt(match[2], 10);
    const verse = parseInt(match[3], 10);

    onAdd({
      source_version: sourceVersion,
      source_book_abbrev: sourceBookAbbrev,
      source_book_name: sourceBookName,
      source_chapter: sourceChapter,
      source_verse: sourceVerse,
      target_version: sourceVersion,
      target_book_abbrev: bookInput.toLowerCase().replace(/\s+/g, ''),
      target_book_name: bookInput,
      target_chapter: chapter,
      target_verse: verse,
      note: noteInput.trim(),
    });

    setRefInput('');
    setNoteInput('');
    toast.success('Referência cruzada adicionada!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
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
        {existingRefs.length > 0 && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
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
                    onClick={() => {
                      onNavigate(targetAbbrev, targetCh, targetV);
                      onOpenChange(false);
                    }}
                  >
                    {targetName} {targetCh}:{targetV}
                  </Button>
                  {ref.note && <span className="text-xs text-muted-foreground flex-1 truncate">— {ref.note}</span>}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive shrink-0"
                    onClick={() => { onDelete(ref.id); toast.success('Referência removida'); }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add new */}
        <div className="space-y-2">
          <Input
            value={refInput}
            onChange={e => setRefInput(e.target.value)}
            placeholder='Referência (ex: "Jo 3:16")'
            className="bg-secondary/50"
          />
          <Textarea
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            placeholder="Nota sobre a conexão (opcional)"
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleAdd} disabled={!refInput.trim()}>
            <Link2 className="w-4 h-4 mr-1" /> Conectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
