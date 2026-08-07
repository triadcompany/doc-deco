import { describe, it, expect } from 'vitest';
import { pdf } from '@react-pdf/renderer';
import { StudyTextDocument } from './StudyTextDocument';
import { parseStudyHtml } from '@/lib/html-to-pdf-nodes';

describe('StudyTextDocument', () => {
  it('generates a real PDF blob from parsed study HTML', async () => {
    const html =
      '<h1>Estudo de João 3</h1><p>Introdução com <b>negrito</b> e <i>itálico</i>.</p>' +
      '<blockquote style="border-left:3px solid hsl(var(--primary));background:hsl(var(--muted)/0.3);">' +
      '<h2>João 3:16</h2><span style="color:hsl(var(--muted-foreground));font-size:0.75em;">16</span>Porque Deus amou o mundo...' +
      '</blockquote>';
    const blocks = parseStudyHtml(html);

    const blob = await pdf(
      <StudyTextDocument
        title="Estudo de teste"
        documentTitles={['Documento A']}
        updatedAtLabel="07 de ago. de 2026"
        blocks={blocks}
      />,
    ).toBlob();

    expect(blob.type).toBe('application/pdf');
    expect(blob.size).toBeGreaterThan(500);
  });
});
