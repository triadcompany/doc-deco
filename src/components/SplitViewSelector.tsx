import {
  BookOpen,
  FolderSearch,
  FolderTree,
  Star,
  Search,
  CheckCircle2,
  FileText,
  Settings,
  Bot,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export const TAB_OPTIONS = [
  { value: 'inicio', icon: BookOpen, label: 'Início' },
  { value: 'biblia', icon: BookOpen, label: 'Bíblia' },
  { value: 'documentos', icon: FolderSearch, label: 'Documentos' },
  { value: 'pastas', icon: FolderTree, label: 'Pastas' },
  { value: 'favoritos', icon: Star, label: 'Favoritos' },
  { value: 'pesquisa', icon: Search, label: 'Pesquisa' },
  { value: 'concluidos', icon: CheckCircle2, label: 'Concluídos' },
  { value: 'resumos', icon: FileText, label: 'Estudo' },
  { value: 'ia', icon: Bot, label: 'IA' },
  { value: 'configuracoes', icon: Settings, label: 'Config' },
] as const;

interface SplitViewSelectorProps {
  value: string;
  onChange: (value: string) => void;
  side: 'left' | 'right';
}

export function SplitViewSelector({ value, onChange, side }: SplitViewSelectorProps) {
  const selectedTab = TAB_OPTIONS.find((t) => t.value === value);

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs w-auto min-w-[140px] gap-1.5 bg-secondary/50 border-border/50">
        <div className="flex items-center gap-1.5">
          {selectedTab && <selectedTab.icon className="w-3.5 h-3.5" />}
          <SelectValue />
        </div>
      </SelectTrigger>
      <SelectContent>
        {TAB_OPTIONS.map((tab) => (
          <SelectItem key={tab.value} value={tab.value}>
            <div className="flex items-center gap-2">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
