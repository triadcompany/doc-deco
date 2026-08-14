import { describe, it, expect } from 'vitest';
import { parseStudyHtml } from './html-to-pdf-nodes';

describe('parseStudyHtml', () => {
  it('preserves H1/H2 hierarchy and paragraph text', () => {
    const html = '<h1>Título Principal</h1><h2>Subtítulo</h2><p>Corpo do texto.</p>';
    const blocks = parseStudyHtml(html);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'heading1' });
    expect(blocks[0].type === 'heading1' && blocks[0].runs.map((r) => r.text).join('')).toBe('Título Principal');
    expect(blocks[1]).toMatchObject({ type: 'heading2' });
    expect(blocks[2]).toMatchObject({ type: 'paragraph' });
  });

  it('preserves bold and italic formatting within a paragraph', () => {
    const html = '<p>Texto <b>negrito</b> e <i>itálico</i> normal.</p>';
    const blocks = parseStudyHtml(html);
    expect(blocks).toHaveLength(1);
    if (blocks[0].type !== 'paragraph') throw new Error('expected paragraph');
    const runs = blocks[0].runs;
    const bold = runs.find((r) => r.text === 'negrito');
    const italic = runs.find((r) => r.text === 'itálico');
    expect(bold?.bold).toBe(true);
    expect(italic?.italic).toBe(true);
    expect(runs.some((r) => r.text.includes('Texto') && !r.bold && !r.italic)).toBe(true);
  });

  it('parses scripture blockquotes (formatVersesAsHtml shape) into a nested quote block', () => {
    // Mirrors the exact structure produced by formatVersesAsHtml in bible-fetch.ts.
    const html =
      '<blockquote style="border-left:3px solid hsl(var(--primary));padding:8px 12px;margin:8px 0;background:hsl(var(--muted)/0.3);border-radius:4px;font-size:0.9em;">' +
      '<h2 style="margin:0 0 4px 0;font-size:1.15em;font-weight:700;">João 3:16</h2>' +
      '<span style="color:hsl(var(--muted-foreground));font-size:0.75em;vertical-align:super;margin-right:2px;">16</span>Porque Deus amou o mundo...' +
      '</blockquote><p><br/></p>';
    const blocks = parseStudyHtml(html);
    const quote = blocks.find((b) => b.type === 'quote');
    expect(quote).toBeDefined();
    if (!quote || quote.type !== 'quote') throw new Error('expected quote block');
    expect(quote.blocks.some((b) => b.type === 'heading2')).toBe(true);
    const flatText = quote.blocks.flatMap((b) => (b.type !== 'quote' ? b.runs.map((r) => r.text) : [])).join('');
    expect(flatText).toContain('Porque Deus amou o mundo');
  });

  it('resolves hsl(var(--x)) colors to literal hsl() values', () => {
    const html = '<span style="color:hsl(var(--primary))">destaque</span>';
    const blocks = parseStudyHtml(html);
    if (blocks[0].type !== 'paragraph') throw new Error('expected paragraph');
    const run = blocks[0].runs[0];
    expect(run.color).toBe('hsl(38, 92%, 50%)');
  });

  it('drops literal colors too light to read on the white PDF page', () => {
    // e.g. text copied from the app's own dark theme, like rgb(231, 235, 239).
    const html = '<p><span style="color: rgb(231, 235, 239)">quase invisível</span> normal.</p>';
    const blocks = parseStudyHtml(html);
    if (blocks[0].type !== 'paragraph') throw new Error('expected paragraph');
    const run = blocks[0].runs.find((r) => r.text.includes('invis'));
    expect(run?.color).toBeUndefined();
  });

  it('keeps literal colors with enough contrast to read on white', () => {
    const html = '<p><span style="color: rgb(180, 30, 30)">vermelho escuro</span></p>';
    const blocks = parseStudyHtml(html);
    if (blocks[0].type !== 'paragraph') throw new Error('expected paragraph');
    expect(blocks[0].runs[0].color).toBe('rgb(180, 30, 30)');
  });

  it('never drops text from unrecognized tags', () => {
    const html = '<p>Antes <u>sublinhado</u> depois <sup>nota</sup>.</p>';
    const blocks = parseStudyHtml(html);
    if (blocks[0].type !== 'paragraph') throw new Error('expected paragraph');
    const flatText = blocks[0].runs.map((r) => r.text).join('');
    expect(flatText).toContain('sublinhado');
    expect(flatText).toContain('nota');
  });

  it('recognizes blocks (paragraphs, blockquotes) nested inside a wrapping <div>', () => {
    // The editor sometimes wraps a whole run of content — several blockquotes and
    // paragraphs — inside one outer <div> (e.g. after pasting a block of text).
    // Regression test: this used to collapse everything into one glued-together
    // paragraph with no blockquote styling and no spacing between blocks.
    const html =
      '<div>' +
      '<p>Texto antes.</p>' +
      '<blockquote style="border-left:3px solid hsl(var(--primary));"><h2>João 3:16</h2><span>16</span>Porque Deus amou o mundo...</blockquote>' +
      '<p>Texto depois.</p>' +
      '</div>';
    const blocks = parseStudyHtml(html);
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'paragraph' });
    expect(blocks[1]).toMatchObject({ type: 'quote' });
    expect(blocks[2]).toMatchObject({ type: 'paragraph' });
    if (blocks[0].type !== 'paragraph' || blocks[2].type !== 'paragraph') throw new Error('expected paragraphs');
    expect(blocks[0].runs.map((r) => r.text).join('')).toContain('Texto antes');
    expect(blocks[2].runs.map((r) => r.text).join('')).toContain('Texto depois');
  });

  it('degrades gracefully on empty or whitespace-only input', () => {
    expect(parseStudyHtml('')).toEqual([]);
    expect(parseStudyHtml('   ')).toEqual([]);
  });
});
