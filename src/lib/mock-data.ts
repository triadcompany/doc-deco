import { PDFDocument } from './types';

export const mockDocuments: PDFDocument[] = [
  {
    id: '1',
    title: 'Introdução à Inteligência Artificial',
    author: 'Carlos Silva',
    date: '2024-03-15',
    fileName: 'Introducao_IA_2024-03-15.pdf',
    fileSize: 2400000,
    pages: 42,
    tags: ['IA', 'Tecnologia'],
    favorite: true,
    createdAt: '2024-03-20T10:00:00Z',
  },
  {
    id: '2',
    title: 'Direito Constitucional Brasileiro',
    author: 'Maria Santos',
    date: '2023-11-08',
    fileName: 'Direito_Constitucional_2023-11-08.pdf',
    fileSize: 5100000,
    pages: 156,
    tags: ['Direito', 'Constituição'],
    favorite: false,
    createdAt: '2024-01-05T14:30:00Z',
  },
  {
    id: '3',
    title: 'Cálculo Diferencial e Integral',
    author: 'João Mendes',
    date: '2024-01-20',
    fileName: 'Calculo_Diferencial_2024-01-20.pdf',
    fileSize: 8900000,
    pages: 320,
    tags: ['Matemática', 'Cálculo'],
    favorite: true,
    createdAt: '2024-02-01T09:15:00Z',
  },
  {
    id: '4',
    title: 'Economia para Iniciantes',
    author: 'Ana Costa',
    date: '2024-06-01',
    fileName: 'Economia_Iniciantes_2024-06-01.pdf',
    fileSize: 3200000,
    pages: 89,
    tags: ['Economia', 'Educação'],
    favorite: false,
    createdAt: '2024-06-10T16:45:00Z',
  },
  {
    id: '5',
    title: 'Manual de Programação Python',
    author: 'Pedro Oliveira',
    date: '2024-02-14',
    fileName: 'Manual_Python_2024-02-14.pdf',
    fileSize: 4500000,
    pages: 210,
    tags: ['Programação', 'Python'],
    favorite: false,
    createdAt: '2024-03-01T11:20:00Z',
  },
  {
    id: '6',
    title: 'Filosofia Moderna',
    author: 'Lucia Ferreira',
    date: '2023-09-30',
    fileName: 'Filosofia_Moderna_2023-09-30.pdf',
    fileSize: 1800000,
    pages: 65,
    tags: ['Filosofia'],
    favorite: true,
    createdAt: '2023-10-15T08:00:00Z',
  },
];

export function parseFileName(fileName: string): { title: string; date: string } {
  const nameWithoutExt = fileName.replace(/\.pdf$/i, '');
  const dateMatch = nameWithoutExt.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
  const title = nameWithoutExt
    .replace(/(\d{4}-\d{2}-\d{2})/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return { title: title || nameWithoutExt, date };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
