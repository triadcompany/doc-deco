import { describe, it, expect } from 'vitest';
import { linesToStudyHtml, PdfLine } from './import-study-pdf';

describe('linesToStudyHtml', () => {
  it('extracts title and a simple paragraph', () => {
    const lines: PdfLine[] = [
      { text: 'Meu Estudo', fontSize: 20, y: 800, page: 1 },
      { text: 'Atualizado em 01 de jan. de 2026', fontSize: 9, y: 780, page: 1 },
      { text: 'Este é o conteúdo do estudo.', fontSize: 10.5, y: 750, page: 1 },
    ];
    const { title, html } = linesToStudyHtml(lines);
    expect(title).toBe('Meu Estudo');
    expect(html).toBe('<p>Este é o conteúdo do estudo.</p>');
  });

  it('recognizes H1 and H2 by font size', () => {
    const lines: PdfLine[] = [
      { text: 'Meu Estudo', fontSize: 20, y: 800, page: 1 },
      { text: 'Atualizado em 01 de jan. de 2026', fontSize: 9, y: 780, page: 1 },
      { text: 'Um Título Grande', fontSize: 18, y: 750, page: 1 },
      { text: 'Um Subtítulo', fontSize: 14, y: 720, page: 1 },
      { text: 'Parágrafo normal.', fontSize: 10.5, y: 690, page: 1 },
    ];
    const { html } = linesToStudyHtml(lines);
    expect(html).toBe(
      '<h1>Um Título Grande</h1><h2>Um Subtítulo</h2><p>Parágrafo normal.</p>'
    );
  });

  it('joins consecutive paragraph lines with a small gap into one <p>', () => {
    const lines: PdfLine[] = [
      { text: 'Meu Estudo', fontSize: 20, y: 800, page: 1 },
      { text: 'Atualizado em 01 de jan. de 2026', fontSize: 9, y: 780, page: 1 },
      { text: 'Primeira linha do parágrafo', fontSize: 10.5, y: 750, page: 1 },
      { text: 'segunda linha do mesmo parágrafo.', fontSize: 10.5, y: 734, page: 1 }, // gap 16 <= 1.6*10.5
    ];
    const { html } = linesToStudyHtml(lines);
    expect(html).toBe('<p>Primeira linha do parágrafo segunda linha do mesmo parágrafo.</p>');
  });

  it('keeps two paragraph lines with a big gap as two <p>', () => {
    const lines: PdfLine[] = [
      { text: 'Meu Estudo', fontSize: 20, y: 800, page: 1 },
      { text: 'Atualizado em 01 de jan. de 2026', fontSize: 9, y: 780, page: 1 },
      { text: 'Primeiro parágrafo.', fontSize: 10.5, y: 750, page: 1 },
      { text: 'Segundo parágrafo, bem depois.', fontSize: 10.5, y: 700, page: 1 }, // gap 50 > 1.6*10.5
    ];
    const { html } = linesToStudyHtml(lines);
    expect(html).toBe('<p>Primeiro parágrafo.</p><p>Segundo parágrafo, bem depois.</p>');
  });

  it('drops everything up to and including the "Atualizado em" line', () => {
    const lines: PdfLine[] = [
      { text: 'Meu Estudo', fontSize: 20, y: 800, page: 1 },
      { text: 'Doc A', fontSize: 8, y: 790, page: 1 },
      { text: 'Doc B', fontSize: 8, y: 785, page: 1 },
      { text: 'Atualizado em 01 de jan. de 2026', fontSize: 9, y: 780, page: 1 },
      { text: 'Conteúdo real do estudo.', fontSize: 10.5, y: 750, page: 1 },
    ];
    const { title, html } = linesToStudyHtml(lines);
    expect(title).toBe('Meu Estudo');
    expect(html).toBe('<p>Conteúdo real do estudo.</p>');
  });

  it('falls back to treating everything after the title as content when there is no "Atualizado em" line', () => {
    const lines: PdfLine[] = [
      { text: 'Título de Outro PDF', fontSize: 16, y: 800, page: 1 },
      { text: 'Conteúdo direto, sem cabeçalho do app.', fontSize: 10.5, y: 750, page: 1 },
    ];
    const { title, html } = linesToStudyHtml(lines);
    expect(title).toBe('Título de Outro PDF');
    expect(html).toBe('<p>Conteúdo direto, sem cabeçalho do app.</p>');
  });

  it('escapes & < > in the extracted text', () => {
    const lines: PdfLine[] = [
      { text: 'Meu Estudo', fontSize: 20, y: 800, page: 1 },
      { text: 'Atualizado em 01 de jan. de 2026', fontSize: 9, y: 780, page: 1 },
      { text: 'Fé & obras, 1 < 2, 3 > 2', fontSize: 10.5, y: 750, page: 1 },
    ];
    const { html } = linesToStudyHtml(lines);
    expect(html).toBe('<p>Fé &amp; obras, 1 &lt; 2, 3 &gt; 2</p>');
  });

  it('returns an empty title/html when there are no lines at all', () => {
    expect(linesToStudyHtml([])).toEqual({ title: '', html: '' });
  });
});
