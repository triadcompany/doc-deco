import { useState, useMemo, useCallback, useEffect } from 'react';

function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[_\s]+/g, ' ').trim();
}
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
import { Search, FileText, LayoutGrid, List, Trash2, X, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DocumentsTabProps {
  documents: PDFDocument[];
  onView: (doc: PDFDocument) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (doc: PDFDocument) => void;
  embedded?: boolean;
}

export function DocumentsTab({ documents, onView, onToggleFavorite, onDelete, onEdit, embedded }: DocumentsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedAuthor, setSelectedAuthor] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [perPage, setPerPage] = useState<number>(30);
  const [currentPage, setCurrentPage] = useState(1);

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
      const q = normalize(searchQuery);
      docs = docs.filter((d) => normalize(d.title).includes(q));
    }
    if (selectedYear !== 'all') {
      docs = docs.filter((d) => d.date.startsWith(selectedYear));
    }
    if (selectedAuthor !== 'all') {
      docs = docs.filter((d) => d.author === selectedAuthor);
    }
    return docs.sort((a, b) => a.date.localeCompare(b.date));
  }, [documents, searchQuery, selectedYear, selectedAuthor]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedYear, selectedAuthor]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocs.map((d) => d.id)));
    }
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      await onDelete(id);
    }
    setConfirmOpen(false);
    exitSelectionMode();
  };

  return (
    <div className="space-y-4">
      {/* Selection bar */}
      {selectionMode && (
        <div className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg border border-border">
          <Checkbox
            checked={selectedIds.size === filteredDocs.length && filteredDocs.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm font-medium flex-1">
            {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <Button
            variant="destructive"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Excluir ({selectedIds.size})
          </Button>
          <Button variant="ghost" size="sm" onClick={exitSelectionMode}>
            <X className="w-4 h-4 mr-1" />
            Cancelar
          </Button>
        </div>
      )}

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

        {!selectionMode && (
          <Button variant="outline" size="sm" className="h-9" onClick={() => setSelectionMode(true)}>
            <CheckSquare className="w-4 h-4 mr-1" />
            Selecionar
          </Button>
        )}

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

      {/* Results count + per page selector */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredDocs.length} documento{filteredDocs.length !== 1 ? 's' : ''} encontrado{filteredDocs.length !== 1 ? 's' : ''}
          {filteredDocs.length > perPage && (
            <span> · Página {currentPage} de {Math.ceil(filteredDocs.length / perPage)}</span>
          )}
        </p>
        <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setCurrentPage(1); }}>
          <SelectTrigger className="w-24 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 / pág</SelectItem>
            <SelectItem value="50">50 / pág</SelectItem>
            <SelectItem value="100">100 / pág</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Documents */}
      {(() => {
        const totalPages = Math.ceil(filteredDocs.length / perPage);
        const paginatedDocs = filteredDocs.slice((currentPage - 1) * perPage, currentPage * perPage);

        return filteredDocs.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">Nenhum documento encontrado</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Tente ajustar os filtros</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className={embedded ? "grid grid-cols-3 gap-3" : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"}>
                {paginatedDocs.map((doc) => (
                  <div key={doc.id} className="relative">
                    {selectionMode && (
                      <div
                        className="absolute top-2 left-2 z-10"
                        onClick={(e) => { e.stopPropagation(); toggleSelect(doc.id); }}
                      >
                        <Checkbox checked={selectedIds.has(doc.id)} />
                      </div>
                    )}
                    <div className={selectionMode && selectedIds.has(doc.id) ? 'ring-2 ring-primary rounded-xl' : ''}>
                      <PDFCard
                        doc={doc}
                        viewMode="grid"
                        onView={selectionMode ? () => toggleSelect(doc.id) : onView}
                        onToggleFavorite={onToggleFavorite}
                        onDelete={onDelete}
                        onEdit={onEdit}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-2">
                    {selectionMode && (
                      <div onClick={(e) => { e.stopPropagation(); toggleSelect(doc.id); }}>
                        <Checkbox checked={selectedIds.has(doc.id)} />
                      </div>
                    )}
                    <div className={`flex-1 ${selectionMode && selectedIds.has(doc.id) ? 'ring-2 ring-primary rounded-xl' : ''}`}>
                      <PDFCard
                        doc={doc}
                        viewMode="list"
                        onView={selectionMode ? () => toggleSelect(doc.id) : onView}
                        onToggleFavorite={onToggleFavorite}
                        onDelete={onDelete}
                        onEdit={onEdit}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  Anterior
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev !== undefined && page - prev > 1;
                    return (
                      <span key={page} className="flex items-center gap-1">
                        {showEllipsis && <span className="text-muted-foreground px-1">…</span>}
                        <Button
                          variant={page === currentPage ? 'default' : 'outline'}
                          size="sm"
                          className="w-9"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      </span>
                    );
                  })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            )}
          </>
        );
      })()}

      {/* Confirm bulk delete */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documentos</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedIds.size} documento{selectedIds.size !== 1 ? 's' : ''}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
