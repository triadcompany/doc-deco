import { createRoot } from 'react-dom/client';
import { pdf } from '@react-pdf/renderer';
import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PDFDocument } from '@/lib/types';
import { DocSummary } from '@/hooks/use-document-summaries';
import { isMindMap } from '@/components/mindmap/types';
import { MindMapViewer } from '@/components/mindmap/MindMapViewer';
import { parseStudyHtml } from '@/lib/html-to-pdf-nodes';
import { StudyTextDocument } from '@/lib/pdf/StudyTextDocument';
import { StudyImageDocument } from '@/lib/pdf/StudyImageDocument';

function getDocTitle(documents: PDFDocument[], id: string): string {
  return documents.find((d) => d.id === id)?.title || 'Documento removido';
}

function getStudyDisplayTitle(summary: DocSummary, documents: PDFDocument[]): string {
  if (summary.title) return summary.title;
  if (summary.documentIds.length > 0) return getDocTitle(documents, summary.documentIds[0]);
  return 'Sem título';
}

function sanitizeFilename(name: string): string {
  const cleaned = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  return cleaned || 'estudo';
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Mounts the mind map off-screen, waits for React Flow's fitView to settle, captures
// it as PNG, then tears everything down. Never throws — returns null on any failure
// (e.g. empty diagram) so the PDF export can still proceed without the image.
async function captureMindMapPng(summaryJson: string): Promise<{ dataUrl: string; width: number; height: number } | null> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-10000px';
  container.style.width = '1200px';
  container.style.height = '800px';
  container.style.background = 'hsl(225, 25%, 8%)';
  document.body.appendChild(container);

  const root = createRoot(container);

  try {
    root.render(<MindMapViewer value={summaryJson} className="w-full h-full" />);

    // Give React Flow a couple of frames + a short delay to lay out nodes and fitView.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise((resolve) => setTimeout(resolve, 300));

    const flowEl = container.querySelector('.react-flow') as HTMLElement | null;
    if (!flowEl) return null;

    const dataUrl = await toPng(flowEl, { pixelRatio: 2, backgroundColor: 'hsl(225, 25%, 8%)' });

    const size = await new Promise<{ width: number; height: number } | null>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });

    return size ? { dataUrl, ...size } : null;
  } catch {
    return null;
  } finally {
    root.unmount();
    container.remove();
  }
}

async function buildStudyPdfBlob(summary: DocSummary, documents: PDFDocument[]): Promise<Blob> {
  const title = getStudyDisplayTitle(summary, documents);
  const documentTitles = summary.documentIds.map((id) => getDocTitle(documents, id));
  const updatedAtLabel = format(new Date(summary.updatedAt), "dd 'de' MMM 'de' yyyy", { locale: ptBR });

  if (isMindMap(summary.summary)) {
    const captured = await captureMindMapPng(summary.summary);
    const doc = (
      <StudyImageDocument
        title={title}
        documentTitles={documentTitles}
        updatedAtLabel={updatedAtLabel}
        imageDataUrl={captured?.dataUrl ?? null}
        imageSize={captured ? { width: captured.width, height: captured.height } : null}
      />
    );
    return pdf(doc).toBlob();
  }

  const blocks = parseStudyHtml(summary.summary);
  const doc = (
    <StudyTextDocument title={title} documentTitles={documentTitles} updatedAtLabel={updatedAtLabel} blocks={blocks} />
  );
  return pdf(doc).toBlob();
}

export async function exportStudyToPdf(summary: DocSummary, documents: PDFDocument[]): Promise<void> {
  const blob = await buildStudyPdfBlob(summary, documents);
  const title = getStudyDisplayTitle(summary, documents);
  triggerDownload(blob, `${sanitizeFilename(title)}.pdf`);
}

export async function exportStudiesToZip(summaries: DocSummary[], documents: PDFDocument[]): Promise<void> {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const summary of summaries) {
    const blob = await buildStudyPdfBlob(summary, documents);
    const base = sanitizeFilename(getStudyDisplayTitle(summary, documents));
    let filename = `${base}.pdf`;
    let n = 2;
    while (usedNames.has(filename)) {
      filename = `${base}-${n}.pdf`;
      n += 1;
    }
    usedNames.add(filename);
    zip.file(filename, blob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const todayLabel = format(new Date(), 'dd-MM-yyyy');
  triggerDownload(zipBlob, `estudos-${todayLabel}.zip`);
}
