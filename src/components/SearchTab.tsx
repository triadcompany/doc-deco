import { useState, useMemo } from 'react';
import { PDFDocument } from '@/lib/types';
import { PDFCard } from '@/components/PDFCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, FileText } from 'lucide-react';

interface SearchTabProps {
  documents: PDFDocument[];
  onView: (doc: PDFDocument) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  authorsList?: string[];
  translatorsList?: string[];
}

type SearchType = 'exact' | 'proximity';

export function SearchTab({ documents, onView, onToggleFavorite, onDelete, authorsList = [], translatorsList = [] }: SearchTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('exact');
  const [selectedAuthor, setSelectedAuthor] = useState('all');
  const [tagsInput, setTagsInput] = useState('');
  const [selectedTranslator, setSelectedTranslator] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const authors = authorsList.length > 0 ? authorsList : (() => {
    const set = new Set<string>();
    documents.forEach((d) => set.add(d.author));
    return Array.from(set).sort();
  })();

  const results = useMemo(() => {
    if (!hasSearched) return [];

    let docs = [...documents];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (searchType === 'exact') {
        docs = docs.filter(
          (d) =>
            d.title.toLowerCase().includes(q) ||
            d.author.toLowerCase().includes(q) ||
            d.fileName.toLowerCase().includes(q)
        );
      } else {
        const words = q.split(/\s+/).filter(Boolean);
        docs = docs.filter((d) => {
          const text = `${d.title} ${d.author} ${d.tags.join(' ')} ${d.fileName}`.toLowerCase();
          return words.every((w) => text.includes(w));
        });
      }
    }

    if (selectedAuthor !== 'all') {
      docs = docs.filter((d) => d.author === selectedAuthor);
    }

    if (tagsInput.trim()) {
      const searchTags = tagsInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
      docs = docs.filter((d) =>
        searchTags.some((st) => d.tags.some((t) => t.toLowerCase().includes(st)))
      );
    }

    if (startDate) {
      docs = docs.filter((d) => d.date >= startDate);
    }

    if (endDate) {
      docs = docs.filter((d) => d.date <= endDate);
    }

    return docs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [documents, searchTerm, searchType, selectedAuthor, tagsInput, startDate, endDate, hasSearched]);

  const handleSearch = () => {
    setHasSearched(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Pesquisa Avançada</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Busque dentro do conteúdo dos documentos
        </p>
      </div>

      {/* Search Card */}
      <div className="glass rounded-xl p-6 space-y-6">
        {/* Search Term */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Termo de pesquisa</Label>
          <div className="flex gap-2">
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite o que deseja encontrar..."
              className="flex-1 h-10 bg-secondary/50"
            />
            <Button onClick={handleSearch} size="icon" className="h-10 w-10 shrink-0">
              <Search className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Search Type */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Tipo de busca</Label>
          <RadioGroup
            value={searchType}
            onValueChange={(v) => setSearchType(v as SearchType)}
            className="space-y-0"
          >
            <div className="flex items-start gap-3 glass rounded-lg p-4 cursor-pointer">
              <RadioGroupItem value="exact" id="exact" className="mt-0.5" />
              <div>
                <Label htmlFor="exact" className="font-semibold cursor-pointer">
                  Frase Exata
                </Label>
                <p className="text-sm text-muted-foreground">
                  Busca pela frase exatamente como digitada
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 glass rounded-lg p-4 cursor-pointer">
              <RadioGroupItem value="proximity" id="proximity" className="mt-0.5" />
              <div>
                <Label htmlFor="proximity" className="font-semibold cursor-pointer">
                  Proximidade de Palavras
                </Label>
                <p className="text-sm text-muted-foreground">
                  Busca palavras que aparecem próximas (dentro de 300 caracteres)
                </p>
              </div>
            </div>
          </RadioGroup>
        </div>

        {/* Separator */}
        <div className="border-t border-border" />

        {/* Additional Filters */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold">Filtros Adicionais</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Autor</Label>
              <Select value={selectedAuthor} onValueChange={setSelectedAuthor}>
                <SelectTrigger className="h-10 bg-secondary/50">
                  <SelectValue placeholder="Todos os autores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os autores</SelectItem>
                  {authors.map((author) => (
                    <SelectItem key={author} value={author}>
                      {author}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Tradução</Label>
              <Select value={selectedTranslator} onValueChange={setSelectedTranslator}>
                <SelectTrigger className="h-10 bg-secondary/50">
                  <SelectValue placeholder="Todas as traduções" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as traduções</SelectItem>
                  {translatorsList.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Tags</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Ex: pregação, estudo (separe por vírgula)"
                className="h-10 bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Data inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-10 bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Data final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-10 bg-secondary/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {results.length} resultado{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
          </p>

          {results.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-muted-foreground">
                Nenhum resultado encontrado
              </p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Tente ajustar os termos ou filtros de pesquisa
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((doc) => (
                <PDFCard
                  key={doc.id}
                  doc={doc}
                  viewMode="list"
                  onView={onView}
                  onToggleFavorite={onToggleFavorite}
                  onDelete={onDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
