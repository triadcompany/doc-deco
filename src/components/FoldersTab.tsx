import { useState, useMemo } from 'react';
import { PDFDocument } from '@/lib/types';
import { PDFCard } from '@/components/PDFCard';
import { ChevronRight, ChevronDown, Folder, FolderOpen, CalendarDays, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FoldersTabProps {
  documents: PDFDocument[];
  onView: (doc: PDFDocument) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (doc: PDFDocument) => void;
}

interface AuthorFolder {
  author: string;
  dateFolders: { date: string; label: string; docs: PDFDocument[] }[];
  totalDocs: number;
}

export function FoldersTab({ documents, onView, onToggleFavorite, onDelete, onEdit }: FoldersTabProps) {
  const [expandedAuthor, setExpandedAuthor] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  const folders = useMemo<AuthorFolder[]>(() => {
    const byAuthor = new Map<string, Map<string, PDFDocument[]>>();

    for (const doc of documents) {
      const author = doc.author || 'Sem autor';
      const dateKey = doc.date?.slice(0, 7) || 'sem-data'; // YYYY-MM
      if (!byAuthor.has(author)) byAuthor.set(author, new Map());
      const dateMap = byAuthor.get(author)!;
      if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
      dateMap.get(dateKey)!.push(doc);
    }

    return Array.from(byAuthor.entries())
      .map(([author, dateMap]) => {
        const dateFolders = Array.from(dateMap.entries())
          .map(([dateKey, docs]) => {
            const label = dateKey === 'sem-data'
              ? 'Sem data'
              : new Date(dateKey + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            return { date: dateKey, label, docs: docs.sort((a, b) => a.title.localeCompare(b.title)) };
          })
          .sort((a, b) => b.date.localeCompare(a.date));

        return {
          author,
          dateFolders,
          totalDocs: dateFolders.reduce((sum, f) => sum + f.docs.length, 0),
        };
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
            {/* Author row */}
            <button
              onClick={() => {
                setExpandedAuthor(isAuthorOpen ? null : folder.author);
                setExpandedDate(null);
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

            {/* Date subfolders */}
            {isAuthorOpen && (
              <div className="border-t border-border bg-secondary/20">
                {folder.dateFolders.map((df) => {
                  const isDateOpen = expandedDate === `${folder.author}__${df.date}`;
                  const dateKey = `${folder.author}__${df.date}`;

                  return (
                    <div key={df.date}>
                      <button
                        onClick={() => setExpandedDate(isDateOpen ? null : dateKey)}
                        className="w-full flex items-center gap-3 px-4 pl-10 py-2.5 hover:bg-secondary/50 transition-colors text-left"
                      >
                        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm flex-1 truncate capitalize">{df.label}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {df.docs.length}
                        </span>
                        {isDateOpen
                          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                      </button>

                      {isDateOpen && (
                        <div className="px-4 pl-14 pb-3 pt-1 space-y-2">
                          {df.docs.map((doc) => (
                            <PDFCard
                              key={doc.id}
                              doc={doc}
                              viewMode="list"
                              onView={onView}
                              onToggleFavorite={onToggleFavorite}
                              onDelete={onDelete}
                              onEdit={onEdit}
                            />
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
