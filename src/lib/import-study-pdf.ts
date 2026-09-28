import { pdfjs } from 'react-pdf';

// Reconstructs a study (title + HTML content) from a PDF exported by this
// app's own "Exportar PDF" feature (src/lib/export-study-pdf.tsx →
// StudyTextDocument.tsx). See docs/superpowers/specs/2026-09-10-importar-estudo-pdf-design.md.

export interface PdfLine {
  text: string;
  fontSize: number;
  y: number;
  page: number;
}

// Calibrated against StudyTextDocument's fixed sizes: title 20, h1 18, h2 14,
// paragraph 10.5, meta 9, badge 8.
const H1_MIN = 16.5;
const H2_MIN = 12.5;
const PARA_MIN = 9.5;
// Consecutive paragraph lines closer together than this (relative to their
// font size) are the same wrapped paragraph, not two separate ones.
const PARA_GAP_FACTOR = 1.6;

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

type BlockType = 'heading1' | 'heading2' | 'paragraph';

interface Block {
  type: BlockType;
  text: string;
  page: number;
  y: number;
  fontSize: number;
}

/**
 * Pure core: classify already-extracted lines into H1/H2/paragraph blocks and
 * serialize to plain HTML. Kept separate from the PDF-reading side so it can
 * be unit-tested with synthetic lines instead of a real PDF file.
 */
export function linesToStudyHtml(lines: PdfLine[]): { title: string; html: string } {
  const nonEmpty = lines.filter((l) => l.text.trim().length > 0);
  if (nonEmpty.length === 0) return { title: '', html: '' };

  const title = nonEmpty[0].text.trim();

  // Everything between the title and the "Atualizado em ..." meta line is
  // this app's own PDF header (title again via badges, doc badges, date) —
  // drop it. If that line doesn't exist (a PDF from somewhere else), fall
  // back to treating everything after the title as content.
  const updatedAtIdx = nonEmpty.findIndex((l) => /^Atualizado em /i.test(l.text.trim()));
  const contentStart = updatedAtIdx !== -1 ? updatedAtIdx + 1 : 1;
  const contentLines = nonEmpty.slice(contentStart);

  const blocks: Block[] = [];

  for (const line of contentLines) {
    const text = line.text.trim();
    if (!text) continue;

    if (line.fontSize >= H1_MIN) {
      blocks.push({ type: 'heading1', text, page: line.page, y: line.y, fontSize: line.fontSize });
    } else if (line.fontSize >= H2_MIN) {
      blocks.push({ type: 'heading2', text, page: line.page, y: line.y, fontSize: line.fontSize });
    } else if (line.fontSize >= PARA_MIN) {
      const prev = blocks[blocks.length - 1];
      const gap = prev ? prev.y - line.y : Infinity;
      const samePage = prev ? prev.page === line.page : false;
      if (prev && prev.type === 'paragraph' && samePage && gap <= PARA_GAP_FACTOR * line.fontSize) {
        prev.text += ' ' + text;
        prev.y = line.y;
      } else {
        blocks.push({ type: 'paragraph', text, page: line.page, y: line.y, fontSize: line.fontSize });
      }
    }
    // else: below PARA_MIN — residual badge/meta text that slipped through, ignore.
  }

  const html = blocks
    .map((b) => {
      const tag = b.type === 'heading1' ? 'h1' : b.type === 'heading2' ? 'h2' : 'p';
      return `<${tag}>${escapeHtml(b.text)}</${tag}>`;
    })
    .join('');

  return { title, html };
}

export async function importStudyFromPdf(file: File): Promise<{ title: string; html: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  const lines: PdfLine[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = (content.items as any[]).filter((item) => typeof item.str === 'string' && item.str.length > 0);

    interface RawItem { x: number; endX: number; str: string }
    interface RawLine { y: number; fontSize: number; items: RawItem[] }
    const rawLines: RawLine[] = [];

    for (const item of items) {
      const x = item.transform[4];
      const y = item.transform[5];
      const fontSize = item.height || Math.abs(item.transform[3]) || 0;
      const endX = x + (item.width || 0);

      // Items within about half a line-height of each other vertically belong
      // to the same visual line (PDF y grows upward, so this is a plain
      // distance check, not "which one is higher").
      let line = rawLines.find((l) => Math.abs(l.y - y) < Math.max(fontSize, l.fontSize, 1) * 0.5);
      if (!line) {
        line = { y, fontSize, items: [] };
        rawLines.push(line);
      }
      line.items.push({ x, endX, str: item.str });
      line.fontSize = Math.max(line.fontSize, fontSize);
    }

    // Top to bottom (y descending), each line's items left to right.
    rawLines.sort((a, b) => b.y - a.y);
    for (const line of rawLines) {
      line.items.sort((a, b) => a.x - b.x);
      const text = line.items.reduce((acc, cur, idx) => {
        if (idx === 0) return cur.str;
        const prevItem = line.items[idx - 1];
        // Adjacent items with a visible gap between them (rather than back to
        // back, which pdf.js sometimes splits mid-word for kerning) need a
        // space reinserted, unless one side already has it.
        const needsSpace = cur.x - prevItem.endX > line.fontSize * 0.15 && !acc.endsWith(' ') && !cur.str.startsWith(' ');
        return acc + (needsSpace ? ' ' : '') + cur.str;
      }, '');
      lines.push({ text, fontSize: line.fontSize, y: line.y, page: pageNum });
    }
  }

  // No text extracted from any page at all — most likely a scanned/image PDF
  // with no text layer (pdfjs can still open the file fine, it just has
  // nothing to hand back). The caller distinguishes this from a merely-empty
  // result (e.g. a title with no content after it, which is fine to import).
  if (lines.length === 0) {
    throw new Error('NO_TEXT_LAYER');
  }

  return linesToStudyHtml(lines);
}
