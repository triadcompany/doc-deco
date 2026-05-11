import { AIChatFilters } from '@/hooks/use-ai-chat';
import { PDFDocument } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Filter } from 'lucide-react';
import { useState } from 'react';

interface ChatFiltersProps {
  filters: AIChatFilters;
  documents: PDFDocument[];
  authors: string[];
  onChange: (filters: AIChatFilters) => void;
}

export function ChatFilters({ filters, documents, authors, onChange }: ChatFiltersProps) {
  const [tagInput, setTagInput] = useState('');

  const allTags = Array.from(new Set(documents.flatMap((d) => d.tags))).sort();
  const hasFilters = filters.author || (filters.tags?.length ?? 0) > 0 || (filters.documentIds?.length ?? 0) > 0;

  const setAuthor = (v: string) => onChange({ ...filters, author: v === 'all' ? undefined : v });

  const addTag = (tag: string) => {
    const current = filters.tags ?? [];
    if (!current.includes(tag)) onChange({ ...filters, tags: [...current, tag] });
    setTagInput('');
  };

  const removeTag = (tag: string) => onChange({ ...filters, tags: filters.tags?.filter((t) => t !== tag) });

  const toggleDoc = (id: string) => {
    const current = filters.documentIds ?? [];
    const next = current.includes(id) ? current.filter((d) => d !== id) : [...current, id];
    onChange({ ...filters, documentIds: next.length > 0 ? next : undefined });
  };

  const clearAll = () => onChange({});

  return (
    <div className="px-3 py-2 border-b border-border/50 bg-secondary/20 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />

        {/* Author filter */}
        <Select value={filters.author || 'all'} onValueChange={setAuthor}>
          <SelectTrigger className="h-7 text-xs w-auto min-w-[120px] bg-background border-border/60">
            <SelectValue placeholder="Todos os autores" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os autores</SelectItem>
            {authors.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tag filter */}
        {allTags.length > 0 && (
          <Select value="" onValueChange={addTag}>
            <SelectTrigger className="h-7 text-xs w-auto min-w-[100px] bg-background border-border/60">
              <SelectValue placeholder="+ Tag" />
            </SelectTrigger>
            <SelectContent>
              {allTags.filter((t) => !filters.tags?.includes(t)).map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Active tags */}
        {filters.tags?.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-[10px] h-6 gap-1 pr-1">
            {tag}
            <button onClick={() => removeTag(tag)} className="hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}

        {/* Clear all */}
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="h-6 text-xs text-muted-foreground px-2">
            Limpar
          </Button>
        )}
      </div>

      {/* Document filter chips */}
      {documents.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <span className="text-[10px] text-muted-foreground self-center mr-1">Docs:</span>
          {documents.slice(0, 12).map((doc) => {
            const selected = filters.documentIds?.includes(doc.id);
            return (
              <button
                key={doc.id}
                onClick={() => toggleDoc(doc.id)}
                className={`text-[10px] rounded-full px-2 py-0.5 transition-colors border ${
                  selected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border/60 hover:border-primary/60'
                }`}
              >
                {doc.title.slice(0, 24)}{doc.title.length > 24 ? '…' : ''}
              </button>
            );
          })}
          {documents.length > 12 && (
            <span className="text-[10px] text-muted-foreground self-center">+{documents.length - 12} mais</span>
          )}
        </div>
      )}
    </div>
  );
}
