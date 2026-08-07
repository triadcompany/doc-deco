// Light print palette — white page, black text (user preference, not the app's
// on-screen dark theme). Keep in sync with LIGHT_THEME_HSL in html-to-pdf-nodes.ts.
export const PDF_COLORS = {
  background: 'hsl(0, 0%, 100%)',
  foreground: 'hsl(220, 25%, 10%)',
  primary: 'hsl(38, 92%, 50%)',
  muted: 'hsl(220, 15%, 94%)',
  mutedForeground: 'hsl(220, 10%, 45%)',
};

// The app's on-screen font is Poppins, but @react-pdf/renderer's font embedding
// (fontkit) corrupts its glyphs — verified broken in both macOS Quartz/CoreGraphics
// and Chrome/PDFium, with two different Poppins TTF sources (the raw google/fonts
// repo file and the actual file fonts.gstatic.com serves to browsers). Built-in
// PDF fonts (Helvetica/Times-Roman/Courier) render correctly everywhere, so PDFs
// use Helvetica instead of chasing a broken custom-font embed.
export const DEFAULT_PDF_FONT = 'Helvetica';
