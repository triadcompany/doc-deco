import { useMemo } from 'react';
import { PDFDocument } from '@/lib/types';
import { PDFCard } from '@/components/PDFCard';
import { Star } from 'lucide-react';

interface FavoritesTabProps {
  documents: PDFDocument[];
  onView: (doc: PDFDocument) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (doc: PDFDocument) => void;
}

export function FavoritesTab({ documents, onView, onToggleFavorite, onDelete, onEdit }: FavoritesTabProps) {
  const favDocs = useMemo(() => 
    documents.filter((d) => d.favorite).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [documents]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {favDocs.length} documento{favDocs.length !== 1 ? 's' : ''} favorito{favDocs.length !== 1 ? 's' : ''}
      </p>

      {favDocs.length === 0 ? (
        <div className="text-center py-20">
          <Star className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-lg font-medium text-muted-foreground">Nenhum favorito ainda</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Clique no ícone ★ em qualquer documento para adicioná-lo aos favoritos
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {favDocs.map((doc) => (
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
      )}
    </div>
  );
}
