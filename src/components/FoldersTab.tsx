import { useState, useMemo } from 'react';
import { PDFDocument } from '@/lib/types';
import { PDFCard } from '@/components/PDFCard';
import { ChevronRight, ChevronDown, Folder, FolderOpen, CalendarDays, BookOpen } from 'lucide-react';

interface FoldersTabProps {
  documents: PDFDocument[];
  onView: (doc: PDFDocument) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (doc: PDFDocument) => void;
}

interface YearFolder {
  year: string;
  docs: PDFDocument[];
}

interface TranslatorFolder {
  translator: string;
  yearFolders: YearFolder[];
  totalDocs: number;
}

interface AuthorFolder {
  author: string;
  // For William Branham: 3-level (translator → year)
  translatorFolders?: TranslatorFolder[];
  // For others: 2-level (year only)
  yearFolders?: YearFolder[];
  totalDocs: number;
}

function getYear(doc: PDFDocument): string {
  return doc.date?.slice(0, 4) || 'sem-data';
}

function yearLabel(y: string): string {
  return y === 'sem-data' ? 'Sem data' : y;
}

export function FoldersTab({ documents, onView, onToggleFavorite, onDelete, onEdit }: FoldersTabProps) {
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);
  const [expandedTranslator, setExpandedTranslator] = useState<string | null>(null);
  const [expandedYear, setExpandedYear] = useState<string | null>(null);

  const folders = useMemo<AuthorFolder[]>(() => {
    const byAuthor = new Map<string, PDFDocument[]>();
    for (const doc of documents) {
      const author = doc.author || 'Sem autor';
      if (!byAuthor.has(author)) byAuthor.set(author, []);
      byAuthor.get(author)!.push(doc);
    }

    return Array.from(byAuthor.entries())
      .map(([author, docs]): AuthorFolder => {
        const isWB = author.toLowerCase().includes('william branham');

        if (isWB) {
          // 3-level: translator → year → docs
          const byTranslator = new Map<string, Map<string, PDFDocument[]>>();
          for (const doc of docs) {
            const translator = doc.translator?.trim() || 'Sem tradutor';
            const year = getYear(doc);
            if (!byTranslator.has(translator)) byTranslator.set(translator, new Map());
            const yearMap = byTranslator.get(translator)!;
            if (!yearMap.has(year)) yearMap.set(year, []);
            yearMap.get(year)!.push(doc);
          }

          const translatorFolders: TranslatorFolder[] = Array.from(byTranslator.entries())
            .map(([translator, yearMap]) => {
              const yearFolders = Array.from(yearMap.entries())
                .map(([year, docs]) => ({ year, docs: docs.sort((a, b) => a.title.localeCompare(b.title)) }))
                .sort((a, b) => b.year.localeCompare(a.year));
              return { translator, yearFolders, totalDocs: docs.filter(d => (d.translator?.trim() || 'Sem tradutor') === translator).length };
            })
            .sort((a, b) => a.translator.localeCompare(b.translator));

          return { author, translatorFolders, totalDocs: docs.length };
        } else {
          // 2-level: year → docs
          const byYear = new Map<string, PDFDocument[]>();
          for (const doc of docs) {
            const year = getYear(doc);
            if (!byYear.has(year)) byYear.set(year, []);
            byYear.get(year)!.push(doc);
          }
          const yearFolders = Array.from(byYear.entries())
            .map(([year, docs]) => ({ year, docs: docs.sort((a, b) => a.title.localeCompare(b.title)) }))
            .sort((a, b) => b.year.localeCompare(a.year));

          return { author, yearFolders, totalDocs: docs.length };
        }
      })
      .sort((a, b) => a.author.localeCompare(b.author));
  }, [documents]);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">
        {folders.length} autor{folders.length !== 1 ? 'es' : ''} · {documents.length} documento{documents.length !== 1 ? 's' : ''}
      </p>

      {folders.map((folder) => {
        const isAuthorOpen = expandedAuthor === folder.author;

        return (
          <div key={folder.author} className="rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => {
                setExpandedAuthor(isAuthorOpen ? null : folder.author);
                setExpandedTranslator(null);
                setExpandedYear(null);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors text-left"
            >
              {isAuthorOpen
                ? <FolderOpen className="w-5 h-5 text-primary shrink-0" />
                : <Folder className="w-5 h-5 text-muted-foreground shrink-0" />}
              <span className="font-medium flex-1 truncate">{folder.author}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {folder.totalDocs} doc{folder.totalDocs !== 1 ? 's' : ''}
              </span>
              {isAuthorOpen
                ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </button>

            {isAuthorOpen && folder.translatorFolders && (
              <div className="border-t border-border bg-secondary/20">
                {folder.translatorFolders.map((tf) => {
                  const transKey = `${folder.author}__${tf.translator}`;
                  const isTransOpen = expandedTranslator === transKey;

                  return (
                    <div key={tf.translator}>
                      <button
                        onClick={() => {
                          setExpandedTranslator(isTransOpen ? null : transKey);
                          setExpandedYear(null);
                        }}
                        className="w-full flex items-center gap-3 px-4 pl-10 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                      >
                        {isTransOpen
                          ? <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                          : <Folder className="w-4 h-4 text-muted-foreground shrink-0" />}
                        <span className="text-sm flex-1 truncate">{tf.translator}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{tf.totalDocs}</span>
                        {isTransOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </button>

                      {isTransOpen && (
                        <div className="border-t border-border/50">
                          {tf.yearFolders.map((yf) => {
                            const yearKey = `${transKey}__${yf.year}`;
                            const isYearOpen = expandedYear === yearKey;

                            return (
                              <div key={yf.year}>
                                <button
                                  onClick={() => setExpandedYear(isYearOpen ? null : yearKey)}
                                  className="w-full flex items-center gap-3 px-4 pl-16 py-2 hover:bg-secondary/50 transition-colors text-left"
                                >
                                  <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-sm flex-1 truncate">{yearLabel(yf.year)}</span>
                                  <span className="text-xs text-muted-foreground tabular-nums">{yf.docs.length}</span>
                                  {isYearOpen
                                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                                </button>

                                {isYearOpen && (
                                  <div className="px-4 pl-20 pb-3 pt-1 space-y-2">
                                    {yf.docs.map((doc) => (
                                      <PDFCard key={doc.id} doc={doc} viewMode="list" onView={onView} onToggleFavorite={onToggleFavorite} onDelete={onDelete} onEdit={onEdit} />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {isAuthorOpen && folder.yearFolders && (
              <div className="border-t border-border bg-secondary/20">
                {folder.yearFolders.map((yf) => {
                  const yearKey = `${folder.author}__${yf.year}`;
                  const isYearOpen = expandedYear === yearKey;

                  return (
                    <div key={yf.year}>
                      <button
                        onClick={() => setExpandedYear(isYearOpen ? null : yearKey)}
                        className="w-full flex items-center gap-3 px-4 pl-10 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                      >
                        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate capitalize">{yearLabel(yf.year)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{yf.docs.length}</span>
                        {isYearOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </button>

                      {isYearOpen && (
                        <div className="px-4 pl-14 pb-3 pt-1 space-y-2">
                          {yf.docs.map((doc) => (
                            <PDFCard key={doc.id} doc={doc} viewMode="list" onView={onView} onToggleFavorite={onToggleFavorite} onDelete={onDelete} onEdit={onEdit} />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
