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
  fontFamily?: string; // 'Poppins' | 'Times-Roman' | 'Courier'
}

export type PdfBlock =
  | { type: 'heading1' | 'heading2' | 'paragraph'; runs: PdfTextRun[] }
  | { type: 'quote'; blocks: PdfBlock[] };

const BASE_FONT_SIZE_PT = 10.5; // matches the app's text-sm (14px) body copy
// @react-pdf/renderer's font embedding corrupts Poppins glyphs (verified broken in
// both macOS Quartz and Chrome/PDFium) — built-in PDF fonts render correctly
// everywhere, so this stays Helvetica. See src/lib/pdf/theme.ts.
const DEFAULT_FONT_FAMILY = 'Helvetica';

// Light-theme HSL triplets (src/index.css :root block) — PDF exports use a white
// page with black text (user preference), not the app's on-screen dark theme.
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

// Content pasted in from elsewhere (e.g. copied from the app's own dark-themed UI)
// sometimes carries a literal light/near-white color — legible on a dark card,
// nearly invisible on this PDF's white page. Parses rgb()/hsl()/hex and returns
// perceived luminance (0 = black, 1 = white) so those colors can be caught and
// dropped rather than rendered unreadable.
function relativeLuminance(color: string): number | null {
  let r: number, g: number, b: number;

  const rgbMatch = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  const hslMatch = color.match(/hsla?\(\s*([\d.]+)[,\s]+([\d.]+)%[,\s]+([\d.]+)%/i);
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (rgbMatch) {
    [r, g, b] = [parseFloat(rgbMatch[1]), parseFloat(rgbMatch[2]), parseFloat(rgbMatch[3])];
  } else if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    if (s === 0) {
      r = g = b = l * 255;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue2rgb = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      r = hue2rgb(h + 1 / 3) * 255;
      g = hue2rgb(h) * 255;
      b = hue2rgb(h - 1 / 3) * 255;
    }
  } else if (hexMatch) {
    const hex = hexMatch[1];
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    r = parseInt(full.slice(0, 2), 16);
    g = parseInt(full.slice(2, 4), 16);
    b = parseInt(full.slice(4, 6), 16);
  } else {
    return null;
  }

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const MAX_LUMINANCE_ON_WHITE = 0.75;

// Resolves `hsl(var(--primary))` / `hsl(var(--muted) / 0.3)` (the only patterns the
// app emits) into a literal color react-pdf can render. Literal colors (hex/rgb/hsl,
// e.g. pasted in from elsewhere) pass through — unless they're too light to read on
// this PDF's white page, in which case they're dropped (falls back to the default
// dark text color) rather than rendered illegible.
function resolveColor(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/var\(--([a-z-]+)\)/i);
  const resolved = match ? LIGHT_THEME_HSL[match[1]] && hslTripletToCss(LIGHT_THEME_HSL[match[1]]) : raw;
  if (!resolved) return undefined;
  const luminance = relativeLuminance(resolved);
  if (luminance !== null && luminance > MAX_LUMINANCE_ON_WHITE) return undefined;
  return resolved;
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
  return DEFAULT_FONT_FAMILY;
}

const ROOT_FONT_SIZE_PT = 12; // 16px root, browser default — rem is relative to this, not to the inherited size

function resolveFontSize(cssFontSize: string | null | undefined, inherited: number): number {
  if (!cssFontSize) return inherited;
  // Check "rem" before "em" — "0.875rem".endsWith('em') is also true.
  if (cssFontSize.endsWith('rem')) {
    const factor = parseFloat(cssFontSize);
    return Number.isFinite(factor) ? ROOT_FONT_SIZE_PT * factor : inherited;
  }
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
      style.fontSizePt = resolveFontSize(getInlineStyleProp(el, 'font-size'), tag === 'h1' ? 18 : 15);
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

    if (tag === 'div') {
      // The editor uses <div> two different ways: as a plain per-line paragraph
      // (contenteditable's default Enter behavior), and as a wrapper around a
      // whole run of other blocks — headings, several <blockquote>s, <p>s — all
      // pasted/typed as one chunk. Recursing through parseBlocks handles both:
      // a div with only inline children just yields a single paragraph block,
      // same as before; a div wrapping other block tags gets each of them
      // recognized as its own block instead of being flattened into one run of
      // inline text (which glued blockquotes/paragraphs together with no
      // spacing and no blockquote styling — the bug this fixes).
      const nested = parseBlocks(el);
      blocks.push(...nested);
      return;
    }

    // p
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
