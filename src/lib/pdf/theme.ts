// Dark-theme palette (src/index.css .dark block) — the app defaults to dark mode,
// so exported PDFs match that instead of a print-style light page. Keep in sync
// with DARK_THEME_HSL in html-to-pdf-nodes.ts.
export const PDF_COLORS = {
  background: 'hsl(225, 25%, 8%)',
  foreground: 'hsl(210, 20%, 92%)',
  primary: 'hsl(38, 92%, 50%)',
  muted: 'hsl(225, 18%, 16%)',
  mutedForeground: 'hsl(215, 15%, 55%)',
};

// The app's on-screen font is Poppins, but @react-pdf/renderer's font embedding
// (fontkit) corrupts its glyphs — verified broken in both macOS Quartz/CoreGraphics
// and Chrome/PDFium, with two different Poppins TTF sources (the raw google/fonts
// repo file and the actual file fonts.gstatic.com serves to browsers). Built-in
// PDF fonts (Helvetica/Times-Roman/Courier) render correctly everywhere, so PDFs
// use Helvetica instead of chasing a broken custom-font embed.
export const DEFAULT_PDF_FONT = 'Helvetica';
