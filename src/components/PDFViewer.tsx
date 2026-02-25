import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { PDFDocument, SearchContext } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useDocumentAnnotations } from '@/hooks/use-document-annotations';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Bookmark,
  Download,
  FileText,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  doc: PDFDocument;
  onBack: () => void;
  searchContext?: SearchContext | null;
}

const highlightColors = [
  { name: 'Amarelo', color: 'hsl(48, 96%, 53%)' },
  { name: 'Verde', color: 'hsl(142, 71%, 45%)' },
  { name: 'Azul', color: 'hsl(217, 91%, 60%)' },
  { name: 'Rosa', color: 'hsl(330, 81%, 60%)' },
  { name: 'Laranja', color: 'hsl(25, 95%, 53%)' },
];

export function PDFViewer({ doc, onBack, searchContext }: PDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(doc.pages || 1);
  const [zoom, setZoom] = useState(100);
  const [activeColor, setActiveColor] = useState(highlightColors[0].color);
  const [highlightMode, setHighlightMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchPageFound, setSearchPageFound] = useState(false);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const { annotations, addAnnotation, removeAnnotation, clearPageAnnotations } = useDocumentAnnotations(doc.id);

  const pdfUrl = doc.url;

  // Measure container width for auto-fit on mobile
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width - 32);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onDocumentLoadSuccess = useCallback(async ({ numPages }: { numPages: number }) => {
    setTotalPages(numPages);
    setLoading(false);

    if (searchContext && !searchPageFound && doc.url) {
      try {
        const pdfjsLib = pdfjs;
        const loadingTask = pdfjsLib.getDocument(doc.url);
        const pdf = await loadingTask.promise;
        
        const termWords = searchContext.searchTerm.split(/\s+/).filter(Boolean);
        const termPattern = termWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
        const termRegex = new RegExp(termPattern, 'i');

        const cleanSnippet = (searchContext.snippet || '').replace(/^\.{3}/, '').replace(/\.{3}$/, '').trim();
        const snippetWords = cleanSnippet.slice(0, 100).split(/\s+/).filter(Boolean).slice(0, 8);
        const snippetPattern = snippetWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*?');
        const snippetRegex = snippetWords.length > 3 ? new RegExp(snippetPattern, 'i') : null;
        
        let found = false;
        for (let i = 1; i <= numPages && !found; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          
          if (snippetRegex && snippetRegex.test(pageText)) {
            setCurrentPage(i);
            setSearchPageFound(true);
            found = true;
          } else if (termRegex.test(pageText)) {
            setCurrentPage(i);
            setSearchPageFound(true);
            found = true;
          }
        }
      } catch (e) {
        console.warn('Could not find search page:', e);
      }
    }
  }, [searchContext, searchPageFound, doc.url]);

  // Highlight search term in the text layer after page render
  useEffect(() => {
    if (!searchContext?.searchTerm) return;
    const container = pageContainerRef.current;
    if (!container) return;

    const timeout = setTimeout(() => {
      const textLayer = container.querySelector('.react-pdf__Page__textContent');
      if (!textLayer) return;

      const walker = document.createTreeWalker(textLayer, NodeFilter.SHOW_TEXT);
      const textNodes: Text[] = [];
      let node: Text | null;
      while ((node = walker.nextNode() as Text | null)) {
        textNodes.push(node);
      }

      let fullText = '';
      const nodeOffsets: { node: Text; start: number; end: number }[] = [];
      for (const tn of textNodes) {
        const start = fullText.length;
        fullText += tn.textContent || '';
        nodeOffsets.push({ node: tn, start, end: fullText.length });
      }

      const words = searchContext.searchTerm.split(/\s+/).filter(Boolean);
      const pattern = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      const regex = new RegExp(pattern, 'gi');

      const matches: { start: number; end: number }[] = [];
      let m: RegExpExecArray | null;
      while ((m = regex.exec(fullText)) !== null) {
        matches.push({ start: m.index, end: m.index + m[0].length });
      }

      if (matches.length === 0) return;

      for (let mi = matches.length - 1; mi >= 0; mi--) {
        const { start: mStart, end: mEnd } = matches[mi];

        for (let ni = nodeOffsets.length - 1; ni >= 0; ni--) {
          const { node: textNode, start: nStart, end: nEnd } = nodeOffsets[ni];
          if (nEnd <= mStart || nStart >= mEnd) continue;

          const highlightStart = Math.max(0, mStart - nStart);
          const highlightEnd = Math.min(textNode.textContent!.length, mEnd - nStart);

          const before = textNode.textContent!.slice(0, highlightStart);
          const highlighted = textNode.textContent!.slice(highlightStart, highlightEnd);
          const after = textNode.textContent!.slice(highlightEnd);

          const parent = textNode.parentNode;
          if (!parent) continue;

          const frag = document.createDocumentFragment();
          if (before) frag.appendChild(document.createTextNode(before));
          const mark = document.createElement('mark');
          mark.style.background = 'hsl(48, 96%, 53%, 0.6)';
          mark.style.color = 'inherit';
          mark.style.borderRadius = '2px';
          mark.style.padding = '0 1px';
          mark.textContent = highlighted;
          frag.appendChild(mark);
          if (after) frag.appendChild(document.createTextNode(after));

          parent.replaceChild(frag, textNode);
        }
      }

      const firstMark = textLayer.querySelector('mark');
      if (firstMark) {
        firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 800);

    return () => clearTimeout(timeout);
  }, [currentPage, searchContext, loading]);

  // Capture text selection and create highlight (persisted to DB)
  const handleSelectionEnd = useCallback(() => {
    if (!highlightMode) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const container = pageContainerRef.current;
    if (!container) return;

    const textLayer = container.querySelector('.react-pdf__Page__textContent');
    if (!textLayer) return;

    const selectionContents = range.cloneContents();
    if (!selectionContents.textContent?.trim()) return;

    const commonAncestor = range.commonAncestorContainer;
    const isInTextLayer =
      textLayer.contains(commonAncestor) ||
      (commonAncestor instanceof Element && commonAncestor.contains(textLayer));

    if (!isInTextLayer) return;

    const pageEl = container.querySelector('.react-pdf__Page');
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();

    const clientRects = range.getClientRects();
    const rects: { top: number; left: number; width: number; height: number }[] = [];
    const pw = pageRect.width;
    const ph = pageRect.height;

    for (let i = 0; i < clientRects.length; i++) {
      const r = clientRects[i];
      if (r.width < 1 || r.height < 1) continue;
      rects.push({
        top: ((r.top - pageRect.top) / ph) * 100,
        left: ((r.left - pageRect.left) / pw) * 100,
        width: (r.width / pw) * 100,
        height: (r.height / ph) * 100,
      });
    }

    if (rects.length === 0) return;

    addAnnotation({
      page: currentPage,
      color: activeColor,
      rects,
      text: selection.toString().trim(),
    });

    selection.removeAllRanges();
  }, [highlightMode, activeColor, currentPage, addAnnotation]);

  // Listen for selection end events
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container || !highlightMode) return;

    const onMouseUp = () => setTimeout(handleSelectionEnd, 10);
    const onTouchEnd = () => setTimeout(handleSelectionEnd, 300);

    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchend', onTouchEnd);

    return () => {
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [highlightMode, handleSelectionEnd]);

  const pageAnnotations = annotations.filter((a) => a.page === currentPage);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <header className="border-b border-border shrink-0 glass mt-[20px] sm:mt-0">
        <div className="h-14 flex items-center justify-between px-2 sm:px-4">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-8 w-8 sm:h-9 sm:w-9">
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm font-semibold truncate">{doc.title}</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{doc.author}</p>
            </div>
          </div>

          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[10px] sm:text-xs text-muted-foreground w-9 sm:w-12 text-center">{zoom}%</span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(200, z + 10))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={highlightMode ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => setHighlightMode(!highlightMode)}
              title="Modo grifo"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Bookmark className="w-3.5 h-3.5" />
            </Button>
            {pdfUrl && (
              <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                <a href={pdfUrl} download={doc.fileName} target="_blank" rel="noopener noreferrer">
                  <Download className="w-3.5 h-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Highlight color bar */}
      {highlightMode && (
        <div className="h-12 border-b border-border flex items-center justify-center gap-3 shrink-0 bg-muted/50">
          <span className="text-xs text-muted-foreground mr-1">Cor:</span>
          {highlightColors.map((c) => (
            <button
              key={c.name}
              className={`w-7 h-7 rounded-full border-2 transition-all ${
                activeColor === c.color
                  ? 'scale-110 border-foreground shadow-md'
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: c.color }}
              onClick={() => setActiveColor(c.color)}
              title={c.name}
            />
          ))}
          {pageAnnotations.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-3 text-xs h-7 text-destructive"
              onClick={() => clearPageAnnotations(currentPage)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Limpar página
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-2"
            onClick={() => setHighlightMode(false)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main ref={mainRef} className="flex-1 flex items-center justify-center bg-muted/30 overflow-auto p-4">
          {pdfUrl ? (
            <div className="relative" ref={pageContainerRef}>
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p className="text-sm">Carregando PDF...</p>
                  </div>
                }
                error={
                  <div className="text-center space-y-3 text-muted-foreground">
                    <FileText className="w-16 h-16 mx-auto opacity-30" />
                    <p className="text-sm">Erro ao carregar PDF</p>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  scale={zoom / 100}
                  width={containerWidth && containerWidth < 700 ? containerWidth / (zoom / 100) : undefined}
                  className="shadow-2xl rounded-lg"
                  renderTextLayer
                  renderAnnotationLayer
                />
              </Document>

              {/* Render persisted highlights overlay */}
              {pageAnnotations.map((h) => {
                const rects = h.position?.rects || [];
                return (
                  <div key={h.id} className="pointer-events-none" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
                    {rects.map((r, i) => {
                      const bgColor = h.color.replace('hsl(', 'hsla(').replace(')', ', 0.4)');
                      // Detect legacy absolute-pixel values (>100 means pixels, not %)
                      const isPercent = r.top <= 100 && r.left <= 100 && r.width <= 100 && r.height <= 100;
                      return (
                      <div
                        key={i}
                        className="absolute pointer-events-auto cursor-pointer"
                        style={{
                          top: isPercent ? `${r.top}%` : r.top,
                          left: isPercent ? `${r.left}%` : r.left,
                          width: isPercent ? `${r.width}%` : r.width,
                          height: isPercent ? `${r.height}%` : r.height,
                          backgroundColor: bgColor,
                          borderRadius: 2,
                        }}
                        onClick={() => {
                          if (highlightMode) removeAnnotation(h.id);
                        }}
                        title={highlightMode ? 'Clique para remover grifo' : h.text}
                      />
                      );
                    })}
                  </div>
                );
              })}

              {/* Tap zones for mobile navigation */}
              {totalPages > 1 && !highlightMode && (
                <>
                  <button
                    className="absolute left-0 top-0 w-1/4 h-full cursor-pointer"
                    style={{ zIndex: 50, opacity: 0, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior"
                  />
                  <button
                    className="absolute right-0 top-0 w-1/4 h-full cursor-pointer"
                    style={{ zIndex: 50, opacity: 0, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    aria-label="Próxima página"
                  />
                </>
              )}
            </div>
          ) : (
            <div
              className="bg-card rounded-lg shadow-2xl flex items-center justify-center"
              style={{
                width: `${(595 * zoom) / 100}px`,
                height: `${(842 * zoom) / 100}px`,
              }}
            >
              <div className="text-center space-y-3 text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto opacity-30" />
                <p className="text-sm">PDF não disponível</p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Bottom bar */}
      <footer className="h-12 border-t border-border flex items-center justify-center gap-3 shrink-0 mb-[20px]">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-muted-foreground">
          Página <span className="text-foreground font-medium">{currentPage}</span> de {totalPages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </footer>
    </div>
  );
}
