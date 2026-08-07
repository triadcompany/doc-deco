// Converts the rich-text HTML produced by RichTextEditor (via document.execCommand,
// plus the scripture/msg-reference blockquote snippets from bible-fetch.ts and
// msg-reference.ts) into a small typed block tree that StudyTextDocument.tsx renders
// as vector PDF text. Preserves H1/H2/bold/italic structure and blockquote citations.
// Any tag outside the known subset still has its text emitted (never dropped).

export interface PdfTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSize?: number; // pt
  fontFamily?: string; // 'Helvetica' | 'Times-Roman' | 'Courier'
}

export type PdfBlock =
  | { type: 'heading1' | 'heading2' | 'paragraph'; runs: PdfTextRun[] }
  | { type: 'quote'; blocks: PdfBlock[] };

const BASE_FONT_SIZE_PT = 11;
const DEFAULT_FONT_FAMILY = 'Helvetica';

// Light-theme HSL triplets (src/index.css :root block). The PDF always prints in the
// light palette regardless of the app's active theme — there's no such thing as a
// "dark" printed page.
const LIGHT_THEME_HSL: Record<string, string> = {
  background: '220 20% 97%',
  foreground: '220 25% 10%',
  primary: '38 92% 50%',
  muted: '220 15% 94%',
  'muted-foreground': '220 10% 45%',
  accent: '38 80% 94%',
};

function hslTripletToCss(triplet: string): string {
  const [h, s, l] = triplet.trim().split(/\s+/);
  return `hsl(${h}, ${s}, ${l})`;
}

// Resolves `hsl(var(--primary))` / `hsl(var(--muted) / 0.3)` (the only patterns the
// app emits) into a literal color react-pdf can render. Anything else passes through.
function resolveColor(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/var\(--([a-z-]+)\)/i);
  if (!match) return raw;
  const triplet = LIGHT_THEME_HSL[match[1]];
  return triplet ? hslTripletToCss(triplet) : undefined;
}

// Reads a property straight from the raw `style` attribute text instead of the
// parsed CSSOM (`el.style.x`) — browsers' CSSOM implementations disagree on whether
// `var()` inside a color function (e.g. `hsl(var(--primary))`) is valid enough to
// keep, so relying on the parsed value can silently drop colors.
function getInlineStyleProp(el: Element, prop: string): string | null {
  const styleAttr = el.getAttribute('style');
  if (!styleAttr) return null;
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const match = styleAttr.match(re);
  return match ? match[1].trim() : null;
}

function resolveFontFamily(face: string | null | undefined, inherited: string): string {
  if (!face) return inherited;
  const f = face.toLowerCase();
  if (f.includes('serif') && !f.includes('sans') || f.includes('georgia') || f.includes('times')) return 'Times-Roman';
  if (f.includes('mono') || f.includes('courier')) return 'Courier';
  return 'Helvetica';
}

function resolveFontSize(cssFontSize: string | null | undefined, inherited: number): number {
  if (!cssFontSize) return inherited;
  if (cssFontSize.endsWith('em')) {
    const factor = parseFloat(cssFontSize);
    return Number.isFinite(factor) ? inherited * factor : inherited;
  }
  if (cssFontSize.endsWith('px')) {
    const px = parseFloat(cssFontSize);
    return Number.isFinite(px) ? px * 0.75 : inherited;
  }
  if (cssFontSize.endsWith('pt')) {
    const pt = parseFloat(cssFontSize);
    return Number.isFinite(pt) ? pt : inherited;
  }
  return inherited;
}

// Same 1..7 scale as the `fontSizes` toolbar list in RichTextEditor.tsx, produced by
// document.execCommand('fontSize', ...) as legacy <font size="N"> tags.
const LEGACY_FONT_SIZE_PX: Record<string, number> = {
  '1': 12, '2': 14, '3': 16, '4': 18, '5': 24, '6': 32, '7': 48,
};

interface InlineStyle {
  bold: boolean;
  italic: boolean;
  color?: string;
  fontSizePt: number;
  fontFamily: string;
}

function baseStyle(): InlineStyle {
  return { bold: false, italic: false, fontSizePt: BASE_FONT_SIZE_PT, fontFamily: DEFAULT_FONT_FAMILY };
}

function toRun(text: string, style: InlineStyle): PdfTextRun {
  return {
    text,
    bold: style.bold,
    italic: style.italic,
    color: style.color,
    fontSize: style.fontSizePt,
    fontFamily: style.fontFamily,
  };
}

function collectRuns(node: Node, style: InlineStyle, out: PdfTextRun[]) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent || '';
    if (text) out.push(toRun(text, style));
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();

  if (tag === 'br') {
    out.push({ text: '\n' });
    return;
  }

  const next: InlineStyle = { ...style };
  if (tag === 'b' || tag === 'strong') next.bold = true;
  if (tag === 'i' || tag === 'em') next.italic = true;
  if (tag === 'span' || tag === 'div') {
    const color = resolveColor(getInlineStyleProp(el, 'color'));
    if (color) next.color = color;
    next.fontSizePt = resolveFontSize(getInlineStyleProp(el, 'font-size'), next.fontSizePt);
  }
  if (tag === 'font') {
    const size = el.getAttribute('size');
    if (size && LEGACY_FONT_SIZE_PX[size]) next.fontSizePt = LEGACY_FONT_SIZE_PX[size] * 0.75;
    next.fontFamily = resolveFontFamily(el.getAttribute('face'), next.fontFamily);
  }

  el.childNodes.forEach((child) => collectRuns(child, next, out));
}

function trimRuns(runs: PdfTextRun[]): PdfTextRun[] {
  return runs.filter((r) => r.text.length > 0);
}

const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'blockquote']);

function parseBlocks(container: Element): PdfBlock[] {
  const blocks: PdfBlock[] = [];
  let buffer: PdfTextRun[] = [];

  const flush = () => {
    const runs = trimRuns(buffer);
    if (runs.length > 0) blocks.push({ type: 'paragraph', runs });
    buffer = [];
  };

  container.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) buffer.push(toRun(text, baseStyle()));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    if (tag === 'br') {
      flush();
      return;
    }

    if (!BLOCK_TAGS.has(tag)) {
      // Unknown inline-ish tag (u, sub, sup, a, ...): never drop content, fold its
      // text into the current paragraph.
      collectRuns(el, baseStyle(), buffer);
      return;
    }

    flush();

    if (tag === 'h1' || tag === 'h2') {
      const style = baseStyle();
      style.bold = true;
      style.fontSizePt = resolveFontSize(getInlineStyleProp(el, 'font-size'), tag === 'h1' ? 20 : 15);
      const color = resolveColor(getInlineStyleProp(el, 'color'));
      if (color) style.color = color;
      const runs: PdfTextRun[] = [];
      el.childNodes.forEach((child) => collectRuns(child, style, runs));
      const finalRuns = trimRuns(runs);
      if (finalRuns.length > 0) blocks.push({ type: tag === 'h1' ? 'heading1' : 'heading2', runs: finalRuns });
      return;
    }

    if (tag === 'blockquote') {
      const nested = parseBlocks(el);
      if (nested.length > 0) blocks.push({ type: 'quote', blocks: nested });
      return;
    }

    // p / div
    const runs: PdfTextRun[] = [];
    el.childNodes.forEach((child) => collectRuns(child, baseStyle(), runs));
    const finalRuns = trimRuns(runs);
    if (finalRuns.length > 0) blocks.push({ type: 'paragraph', runs: finalRuns });
  });

  flush();
  return blocks;
}

export function parseStudyHtml(html: string): PdfBlock[] {
  if (!html || !html.trim()) return [];
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstElementChild;
    if (!root) return [];
    return parseBlocks(root);
  } catch {
    // Parse errors must never block an export — degrade to plain text.
    const stripped = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped ? [{ type: 'paragraph', runs: [{ text: stripped, fontSize: BASE_FONT_SIZE_PT, fontFamily: DEFAULT_FONT_FAMILY }] }] : [];
  }
}
