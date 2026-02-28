import { useState } from 'react';
import { SearchContext } from '@/lib/types';
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
import { Search, FileText, Loader2, Copy, Check } from 'lucide-react';
import { PDFDocument } from '@/lib/types';
import React from 'react';

function formatCitationAPA(doc: PDFDocument): string {
  const author = doc.author || 'Autor desconhecido';
  let year = '';
  if (doc.date) {
    const match = doc.date.match(/(\d{4})/);
    year = match ? match[1] : 's.d.';
  } else {
    year = 's.d.';
  }
  const title = doc.title || 'Sem título';
  const pages = doc.pages ? ` (${doc.pages} p.)` : '';
  return `${author}. (${year}). ${title}${pages}. [Documento digital].`;
}

function normalizeForHighlight(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function highlightTerm(text: string, term: string, searchType: 'exact' | 'proximity' = 'exact'): React.ReactNode {
  if (!term) return text;
  const normTerm = normalizeForHighlight(term);
  let pattern: string;
  if (searchType === 'exact') {
    pattern = normTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  } else {
    const words = normTerm.split(/\s+/).filter(Boolean);
    pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  }
  const regex = new RegExp(`(${pattern})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) => {
    const testRegex = new RegExp(`^(${pattern})$`, 'i');
    return testRegex.test(part)
      ? <mark key={i} className="bg-yellow-300/60 text-foreground rounded-sm px-0.5 font-medium">{part}</mark>
      : part;
  });
}
function SearchResultItem({ doc, currentTerm, searchType, onView, onToggleFavorite, onDelete }: {
  doc: PDFDocument & { snippet?: string };
  currentTerm: string;
  searchType: 'exact' | 'proximity';
  onView: (doc: PDFDocument, searchContext?: SearchContext) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const citation = formatCitationAPA(doc);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(citation);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-0">
      <PDFCard
        doc={doc}
        viewMode="list"
        onView={() => onView(doc, doc.snippet && currentTerm ? { searchTerm: currentTerm, snippet: doc.snippet } : undefined)}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
      />
      {doc.snippet && (
        <div className="ml-14 mr-4 -mt-1 mb-2 px-3 py-2 rounded-b-lg bg-secondary/30 border border-t-0 border-border/50">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {highlightTerm(doc.snippet, currentTerm, searchType)}
          </p>
        </div>
      )}
    </div>
  );
}

interface SearchTabProps {
  documents: PDFDocument[];
  onView: (doc: PDFDocument, searchContext?: SearchContext) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  authorsList?: string[];
  translatorsList?: string[];
  searchContent: (term: string, searchType: 'exact' | 'proximity', filters?: { author?: string; translator?: string; tags?: string[]; startDate?: string; endDate?: string }) => Promise<(PDFDocument & { snippet?: string })[]>;
}

type SearchType = 'exact' | 'proximity';

export function SearchTab({ documents, onView, onToggleFavorite, onDelete, authorsList = [], translatorsList = [], searchContent }: SearchTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('exact');
  const [selectedAuthor, setSelectedAuthor] = useState('all');
  
  const [selectedTranslator, setSelectedTranslator] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<(PDFDocument & { snippet?: string })[]>([]);
  const [searching, setSearching] = useState(false);
  const [currentTerm, setCurrentTerm] = useState('');

  const authors = authorsList.length > 0 ? authorsList : (() => {
    const set = new Set<string>();
    documents.forEach((d) => { if (d.author) set.add(d.author); });
    return Array.from(set).sort();
  })();

  const translators = translatorsList.length > 0 ? translatorsList : (() => {
    const set = new Set<string>();
    documents.forEach((d) => { if (d.translator) set.add(d.translator); });
    return Array.from(set).sort();
  })();

  const handleSearch = async () => {
    setHasSearched(true);
    setSearching(true);
    setCurrentTerm(searchTerm);
    try {
      const res = await searchContent(searchTerm, searchType, {
        author: selectedAuthor,
        translator: selectedTranslator,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setResults(res);
    } finally {
      setSearching(false);
    }
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
            <Button onClick={handleSearch} size="icon" className="h-10 w-10 shrink-0" disabled={searching}>
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
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
                  {translators.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <div className="space-y-3">
              {results.map((doc, index) => (
                <SearchResultItem
                  key={`${doc.id}-${index}`}
                  doc={doc}
                  currentTerm={currentTerm}
                  searchType={searchType}
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
