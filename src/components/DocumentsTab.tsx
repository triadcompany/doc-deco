import { useState, useMemo } from 'react';
import { PDFDocument } from '@/lib/types';
import { PDFCard } from '@/components/PDFCard';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FileText, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DocumentsTabProps {
  documents: PDFDocument[];
  onView: (doc: PDFDocument) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (doc: PDFDocument) => void;
}

export function DocumentsTab({ documents, onView, onToggleFavorite, onDelete, onEdit }: DocumentsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const years = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => {
      const year = d.date.split('-')[0];
      if (year) set.add(year);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [documents]);

  const authors = useMemo(() => {
    const set = new Set<string>();
    documents.forEach((d) => { if (d.author) set.add(d.author); });
    return Array.from(set).sort();
  }, [documents]);

  const filteredDocs = useMemo(() => {
    let docs = [...documents];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter((d) => d.title.toLowerCase().includes(q));
    }

    if (selectedYear !== 'all') {
      docs = docs.filter((d) => d.date.startsWith(selectedYear));
    }

    if (selectedAuthor !== 'all') {
      docs = docs.filter((d) => d.author === selectedAuthor);
    }

    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [documents, searchQuery, selectedYear, selectedAuthor]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Pesquisar pelo nome..."
            className="pl-9 h-9 bg-secondary/50"
          />
        </div>

        <Select value={selectedYear} onValueChange={setSelectedYear}>
          <SelectTrigger className="w-full sm:w-[140px] h-9">
            <SelectValue placeholder="Ano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os anos</SelectItem>
            {years.map((year) => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
          <SelectTrigger className="w-full sm:w-[180px] h-9">
            <SelectValue placeholder="Autor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os autores</SelectItem>
            {authors.map((author) => (
              <SelectItem key={author} value={author}>{author}</SelectItem>
            ))}
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

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {filteredDocs.length} documento{filteredDocs.length !== 1 ? 's' : ''} encontrado{filteredDocs.length !== 1 ? 's' : ''}
      </p>

      {/* Documents */}
      {filteredDocs.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum documento encontrado</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Tente ajustar os filtros</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredDocs.map((doc) => (
            <PDFCard
              key={doc.id}
              doc={doc}
              viewMode="grid"
              onView={onView}
              onToggleFavorite={onToggleFavorite}
              onDelete={onDelete}
              onEdit={onEdit}
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
}
