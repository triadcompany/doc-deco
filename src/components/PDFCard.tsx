import { PDFDocument } from '@/lib/types';
import { formatFileSize } from '@/lib/mock-data';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, FileText, MoreVertical, Eye, Trash2, Pencil, Pin } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PDFCardProps {
  doc: PDFDocument;
  viewMode: 'grid' | 'list';
  onView: (doc: PDFDocument) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (doc: PDFDocument) => void;
  onTogglePin?: (id: string) => void;
  isPinned?: boolean;
}

const colors = [
  'from-amber-500/20 to-orange-500/10',
  'from-blue-500/20 to-cyan-500/10',
  'from-purple-500/20 to-pink-500/10',
  'from-emerald-500/20 to-teal-500/10',
  'from-rose-500/20 to-red-500/10',
];

export function PDFCard({ doc, viewMode, onView, onToggleFavorite, onDelete, onEdit, onTogglePin, isPinned }: PDFCardProps) {
  const colorIndex = doc.title.length % colors.length;

  if (viewMode === 'list') {
    return (
      <Card
        className="group flex items-center gap-4 p-3 hover:bg-accent/30 transition-all cursor-pointer border-border/50"
        onClick={() => onView(doc)}
      >
        <div className={`w-10 h-12 rounded-md bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center shrink-0`}>
          <FileText className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm">{doc.title}</h3>
          <p className="text-xs text-muted-foreground">
            {doc.author}
            {doc.author === 'William Branham' && doc.translator && ` · ${doc.translator}`}
            {' · '}{doc.date} · {formatFileSize(doc.fileSize)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {doc.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px] h-5">{tag}</Badge>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc.id); }}
        >
          <Star className={`w-4 h-4 ${doc.favorite ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={() => onView(doc)}>
              <Eye className="w-4 h-4 mr-2" /> Visualizar
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(doc)}>
                <Pencil className="w-4 h-4 mr-2" /> Editar
              </DropdownMenuItem>
            )}
            {onTogglePin && (
              <DropdownMenuItem onClick={() => onTogglePin(doc.id)}>
                <Pin className="w-4 h-4 mr-2" /> {isPinned ? 'Desafixar' : 'Fixar'}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(doc.id)}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>
    );
  }

  return (
    <Card
      className="group overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer border-border/50 hover:border-primary/30"
      onClick={() => onView(doc)}
    >
      <div className={`h-36 bg-gradient-to-br ${colors[colorIndex]} flex items-center justify-center relative`}>
        <FileText className="w-12 h-12 text-primary/60" />
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 bg-background/50 backdrop-blur-sm"
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(doc.id); }}
          >
            <Star className={`w-3.5 h-3.5 ${doc.favorite ? 'fill-primary text-primary' : ''}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 bg-background/50 backdrop-blur-sm">
                <MoreVertical className="w-3.5 h-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onView(doc)}>
                <Eye className="w-4 h-4 mr-2" /> Visualizar
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={() => onEdit(doc)}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar
                </DropdownMenuItem>
              )}
              {onTogglePin && (
                <DropdownMenuItem onClick={() => onTogglePin(doc.id)}>
                  <Pin className="w-4 h-4 mr-2" /> {isPinned ? 'Desafixar' : 'Fixar'}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="text-destructive" onClick={() => onDelete(doc.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {doc.pages && (
          <span className="absolute bottom-2 right-2 text-[10px] bg-background/70 backdrop-blur-sm rounded px-1.5 py-0.5 text-muted-foreground">
            {doc.pages} págs
          </span>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-sm leading-tight">{doc.title}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {doc.author}
              {doc.author === 'William Branham' && doc.translator && ` · ${doc.translator}`}
            </p>
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">{doc.date}</span>
          <span className="text-[10px] text-muted-foreground">{formatFileSize(doc.fileSize)}</span>
        </div>
        {doc.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {doc.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">{tag}</Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
