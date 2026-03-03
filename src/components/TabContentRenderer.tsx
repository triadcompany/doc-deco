import { Suspense, lazy } from 'react';
import { PDFDocument, SearchContext } from '@/lib/types';
import { DocSummary } from '@/hooks/use-document-summaries';
import { SettingsEntry } from '@/hooks/use-settings';
import { DocumentsTab } from '@/components/DocumentsTab';
import { FoldersTab } from '@/components/FoldersTab';
import { FavoritesTab } from '@/components/FavoritesTab';
import { CompletedTab } from '@/components/CompletedTab';
import { SearchTab } from '@/components/SearchTab';
import { Loader2 } from 'lucide-react';

const SettingsTab = lazy(() => import('@/components/SettingsTab').then(m => ({ default: m.SettingsTab })));
const MetaTab = lazy(() => import('@/components/MetaTab').then(m => ({ default: m.MetaTab })));
const BibleTab = lazy(() => import('@/components/BibleTab').then(m => ({ default: m.BibleTab })));
const SummariesTab = lazy(() => import('@/components/SummariesTab').then(m => ({ default: m.SummariesTab })));

const SuspenseFallback = () => (
  <div className="flex justify-center py-20">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

export interface TabContentProps {
  tabId: string;
  embedded?: boolean;
  documents: PDFDocument[];
  onViewDoc: (doc: PDFDocument, ctx?: SearchContext) => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (doc: PDFDocument) => void;
  // Search
  authors: string[];
  translators: string[];
  searchContent: (term: string, searchType: 'exact' | 'proximity', filters?: { author?: string; translator?: string; tags?: string[]; startDate?: string; endDate?: string }) => Promise<(PDFDocument & { snippet?: string })[]>;
  // Summaries
  summaries: DocSummary[];
  summariesLoading: boolean;
  upsertSummary: (id: string | null, title: string, documentIds: string[], summary: string) => Promise<void>;
  deleteSummary: (id: string) => Promise<void>;
  // Goals
  goal: any;
  completedThisMonth: number;
  upsertGoal: any;
  resetMonthlyProgress: any;
  progress: any[];
  // Settings
  settingsAuthors: SettingsEntry[];
  settingsTranslators: SettingsEntry[];
  addAuthor: (name: string) => void;
  removeAuthor: (id: string) => void;
  addTranslator: (name: string) => void;
  removeTranslator: (id: string) => void;
  // Home extras
  renderHomeContent?: () => React.ReactNode;
}

export function TabContentRenderer({ tabId, ...props }: TabContentProps) {
  switch (tabId) {
    case 'inicio':
      return props.renderHomeContent?.() ?? null;

    case 'documentos':
      return (
        <DocumentsTab
          documents={props.documents}
          onView={props.onViewDoc}
          onToggleFavorite={props.onToggleFavorite}
          onDelete={props.onDelete}
          onEdit={props.onEdit}
        />
      );

    case 'pastas':
      return (
        <FoldersTab
          documents={props.documents}
          onView={props.onViewDoc}
          onToggleFavorite={props.onToggleFavorite}
          onDelete={props.onDelete}
          onEdit={props.onEdit}
        />
      );

    case 'favoritos':
      return (
        <FavoritesTab
          documents={props.documents}
          onView={props.onViewDoc}
          onToggleFavorite={props.onToggleFavorite}
          onDelete={props.onDelete}
          onEdit={props.onEdit}
        />
      );

    case 'concluidos':
      return (
        <CompletedTab
          documents={props.documents}
          progress={props.progress}
          onView={props.onViewDoc}
          onToggleFavorite={props.onToggleFavorite}
          onDelete={props.onDelete}
          onEdit={props.onEdit}
        />
      );

    case 'pesquisa':
      return (
        <SearchTab
          documents={props.documents}
          onView={props.onViewDoc}
          onToggleFavorite={props.onToggleFavorite}
          onDelete={props.onDelete}
          authorsList={props.authors}
          translatorsList={props.translators}
          searchContent={props.searchContent}
        />
      );

    case 'resumos':
      return (
        <Suspense fallback={<SuspenseFallback />}>
          <SummariesTab
            documents={props.documents}
            summaries={props.summaries}
            loading={props.summariesLoading}
            onUpsert={props.upsertSummary}
            onDelete={props.deleteSummary}
            onViewDoc={props.onViewDoc}
            embedded={props.embedded}
          />
        </Suspense>
      );

    case 'biblia':
      return (
        <Suspense fallback={<SuspenseFallback />}>
          <BibleTab />
        </Suspense>
      );

    case 'configuracoes':
      return (
        <Suspense fallback={<SuspenseFallback />}>
          <SettingsTab
            authors={props.settingsAuthors}
            translators={props.settingsTranslators}
            addAuthor={props.addAuthor}
            removeAuthor={props.removeAuthor}
            addTranslator={props.addTranslator}
            removeTranslator={props.removeTranslator}
          />
        </Suspense>
      );

    default:
      return null;
  }
}
