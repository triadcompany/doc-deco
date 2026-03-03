import { useMemo, useState } from 'react';
import { PDFDocument } from '@/lib/types';
import { PDFCard } from '@/components/PDFCard';
import { ReadingProgressItem } from '@/hooks/use-reading-goals';
import { CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CompletedTabProps {
  documents: PDFDocument[];
  progress: ReadingProgressItem[];
  onView: (doc: PDFDocument) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (doc: PDFDocument) => void;
  onUnmarkCompleted?: (id: string) => void;
}

const MONTH_NAMES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

interface GroupedData {
  year: number;
  months: {
    month: number;
    docs: PDFDocument[];
  }[];
}

export function CompletedTab({ documents, progress, onView, onToggleFavorite, onDelete, onEdit, onUnmarkCompleted }: CompletedTabProps) {
  const [openYears, setOpenYears] = useState<Set<number>>(new Set());

  const grouped = useMemo(() => {
    const completed = progress.filter(p => p.completed && p.completed_at);
    const map = new Map<string, { year: number; month: number; doc: PDFDocument }>();

    for (const rp of completed) {
      const doc = documents.find(d => d.id === rp.document_id);
      if (!doc || !rp.completed_at) continue;
      const date = new Date(rp.completed_at);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}-${doc.id}`;
      if (!map.has(key)) {
        map.set(key, { year, month, doc });
      }
    }

    const entries = Array.from(map.values());
    const yearMap = new Map<number, Map<number, PDFDocument[]>>();

    for (const { year, month, doc } of entries) {
      if (!yearMap.has(year)) yearMap.set(year, new Map());
      const mMap = yearMap.get(year)!;
      if (!mMap.has(month)) mMap.set(month, []);
      mMap.get(month)!.push(doc);
    }

    const result: GroupedData[] = [];
    for (const [year, mMap] of yearMap) {
      const months = Array.from(mMap.entries())
        .sort(([a], [b]) => b - a)
        .map(([month, docs]) => ({ month, docs }));
      result.push({ year, months });
    }
    result.sort((a, b) => b.year - a.year);

    return result;
  }, [documents, progress]);

  const totalCompleted = grouped.reduce((sum, y) => sum + y.months.reduce((s, m) => s + m.docs.length, 0), 0);

  const toggleYear = (year: number) => {
    setOpenYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year); else next.add(year);
      return next;
    });
  };

  // Auto-open current year
  const currentYear = new Date().getFullYear();
  if (grouped.length > 0 && openYears.size === 0) {
    openYears.add(grouped[0].year);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {totalCompleted} documento{totalCompleted !== 1 ? 's' : ''} concluído{totalCompleted !== 1 ? 's' : ''}
      </p>

      {totalCompleted === 0 ? (
        <div className="text-center py-20">
          <CheckCircle2 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum documento concluído</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Marque documentos como concluídos usando o ícone ✓ verde
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ year, months }) => (
            <Collapsible key={year} open={openYears.has(year)} onOpenChange={() => toggleYear(year)}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 px-3 rounded-lg hover:bg-accent/50 transition-colors">
                {openYears.has(year) ? (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-lg font-bold">{year}</span>
                <span className="text-sm text-muted-foreground ml-auto">
                  {months.reduce((s, m) => s + m.docs.length, 0)} doc{months.reduce((s, m) => s + m.docs.length, 0) !== 1 ? 's' : ''}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-2">
                {months.map(({ month, docs }) => (
                  <div key={month} className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground px-3">
                      {MONTH_NAMES[month]} — {docs.length} doc{docs.length !== 1 ? 's' : ''}
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {docs.map(doc => (
                        <PDFCard
                          key={doc.id}
                          doc={doc}
                          viewMode="grid"
                          onView={onView}
                          onToggleFavorite={onToggleFavorite}
                          onDelete={onDelete}
                          onEdit={onEdit}
                          onMarkCompleted={onUnmarkCompleted}
                          isCompleted={true}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
