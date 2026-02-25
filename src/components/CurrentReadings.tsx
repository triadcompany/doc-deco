import { PDFDocument } from '@/lib/types';
import { ReadingProgressItem } from '@/hooks/use-reading-goals';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { BookOpen, CheckCircle, X } from 'lucide-react';

interface CurrentReadingsProps {
  documents: PDFDocument[];
  currentReadings: ReadingProgressItem[];
  onView: (doc: PDFDocument) => void;
  onMarkCompleted: (documentId: string) => void;
  onRemove: (documentId: string) => void;
}

export function CurrentReadings({
  documents,
  currentReadings,
  onView,
  onMarkCompleted,
  onRemove,
}: CurrentReadingsProps) {
  if (currentReadings.length === 0) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">Nenhuma leitura em andamento</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Abra um documento e comece a ler!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {currentReadings.map((rp) => {
        const doc = documents.find((d) => d.id === rp.document_id);
        if (!doc) return null;
        const totalPages = doc.pages ?? 0;
        const pct = totalPages > 0 ? Math.min((rp.current_page / totalPages) * 100, 100) : 0;

        return (
          <Card
            key={rp.id}
            className="glass border-border/50 p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors cursor-pointer group"
            onClick={() => onView(doc)}
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              <p className="text-sm font-semibold leading-tight">{doc.title}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{doc.author}</span>
                <span>·</span>
                <span>
                  Pág. {rp.current_page}{totalPages > 0 ? ` / ${totalPages}` : ''}
                </span>
              </div>
              {totalPages > 0 && <Progress value={pct} className="h-1.5" />}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-green-500 hover:text-green-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkCompleted(doc.id);
                }}
                title="Marcar como lido"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(doc.id);
                }}
                title="Remover"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
