export type DocVisibility = 'global' | 'personal';

export interface PDFDocument {
  id: string;
  title: string;
  author: string;
  date: string;
  fileName: string;
  fileSize: number;
  pages?: number;
  tags: string[];
  favorite: boolean;
  createdAt: string;
  url?: string;
  visibility: DocVisibility;
}

export interface Annotation {
  id: string;
  documentId: string;
  page: number;
  text: string;
  color: string;
  position: { x: number; y: number; width: number; height: number };
  createdAt: string;
}

export type ViewMode = 'grid' | 'list';
export type SortBy = 'title' | 'author' | 'date' | 'createdAt';
