import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { PDFDocument, SearchContext } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useDocumentAnnotations } from '@/hooks/use-document-annotations';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Highlighter,
  Download,
  FileText,
  Loader2,
  Trash2,
  Search,
  X,
  Eraser,
  MoreVertical,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export interface PDFViewerProps {
  doc: PDFDocument;
  onBack: () => void;
  searchContext?: SearchContext | null;
  embedded?: boolean;
}

const highlightColors = [
  { name: 'Amarelo', color: 'hsl(48, 96%, 53%)' },
  { name: 'Verde', color: 'hsl(142, 71%, 45%)' },
  { name: 'Azul', color: 'hsl(217, 91%, 60%)' },
  { name: 'Rosa', color: 'hsl(330, 81%, 60%)' },
  { name: 'Laranja', color: 'hsl(25, 95%, 53%)' },
];

export function PDFViewer({ doc, onBack, searchContext, embedded = false }: PDFViewerProps) {
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(doc.pages || 1);
  const getInitialZoom = () => {
    const w = window.innerWidth;
    if (w >= 768 && w < 1280) return 160; // iPad/tablet
    return 100;
  };
  const [zoom, setZoom] = useState(getInitialZoom);
  const [activeColor, setActiveColor] = useState(highlightColors[0].color);
  const [highlightMode, setHighlightMode] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchPageFound, setSearchPageFound] = useState(false);
  const [inDocSearch, setInDocSearch] = useState(false);
  const [inDocSearchTerm, setInDocSearchTerm] = useState('');
  const [inDocResults, setInDocResults] = useState<{ page: number; index: number }[]>([]);
  const [inDocResultIdx, setInDocResultIdx] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  const { annotations, addAnnotation, removeAnnotation, clearPageAnnotations } = useDocumentAnnotations(doc.id);

  const pdfDocRef = useRef<any>(null);
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

  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    const numPages = pdf.numPages;
    setTotalPages(numPages);
    setLoading(false);

    // Reuse the already-loaded pdf instance (avoid double download)
    pdfDocRef.current = pdf;

    if (searchContext && !searchPageFound) {
      const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      try {
        const termNorm = normalize(searchContext.searchTerm);
        const termWords = termNorm.split(/\s+/).filter(Boolean);
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
          const pageText = normalize(textContent.items.map((item: any) => item.str).join(' '));

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
  }, [searchContext, searchPageFound]);

  // In-document search
  const executeInDocSearch = useCallback(async (term: string) => {
    if (!term.trim() || !pdfDocRef.current) {
      setInDocResults([]);
      setInDocResultIdx(0);
      return;
    }
    setIsSearching(true);
    const pdf = pdfDocRef.current;
    const results: { page: number; index: number }[] = [];
    const escapedTerm = term.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTerm, 'gi');

    for (let i = 1; i <= totalPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(pageText)) !== null) {
          results.push({ page: i, index: results.length });
        }
      } catch {}
    }
    setInDocResults(results);
    setInDocResultIdx(0);
    if (results.length > 0) {
      setCurrentPage(results[0].page);
    }
    setIsSearching(false);
  }, [totalPages]);

  const goToInDocResult = useCallback((idx: number) => {
    if (inDocResults.length === 0) return;
    const wrapped = ((idx % inDocResults.length) + inDocResults.length) % inDocResults.length;
    setInDocResultIdx(wrapped);
    setCurrentPage(inDocResults[wrapped].page);
  }, [inDocResults]);

  useEffect(() => {
    if (inDocSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [inDocSearch]);

  const activeSearchTerm = inDocSearch && inDocSearchTerm.trim() ? inDocSearchTerm.trim() : searchContext?.searchTerm || '';

  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container) return;

    // Always clean previous highlight marks first (avoid stale marks accumulating
    // when user changes pages or clears the search term).
    const cleanupOldMarks = () => {
      const layer = container.querySelector('.react-pdf__Page__textContent');
      if (!layer) return;
      const oldMarks = layer.querySelectorAll('mark[data-search-mark]');
      oldMarks.forEach((m) => {
        const parent = m.parentNode;
        if (!parent) return;
        const text = document.createTextNode(m.textContent || '');
        parent.replaceChild(text, m);
        parent.normalize();
      });
    };
    cleanupOldMarks();

    if (!activeSearchTerm) return;

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

      // Build normalized text with position mapping to original
      const nfdText = fullText.normalize('NFD');
      let normText = '';
      const normToOrig: number[] = []; // normText index -> original fullText index
      let origIdx = 0;
      for (let ci = 0; ci < nfdText.length; ci++) {
        const code = nfdText.charCodeAt(ci);
        // Skip combining diacritical marks (0x0300–0x036f)
        if (code >= 0x0300 && code <= 0x036f) {
          // don't increment origIdx for combining chars within same base char
          continue;
        }
        normText += nfdText[ci].toLowerCase();
        normToOrig.push(origIdx);
        origIdx++;
      }
      normToOrig.push(fullText.length); // sentinel

      const termNorm = activeSearchTerm.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      // Split term into words and join with flexible whitespace to handle PDF text layer spacing
      const termWords = termNorm.split(/\s+/).filter(Boolean);
      const pattern = termWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*');
      const regex = new RegExp(pattern, 'gi');

      const matches: { start: number; end: number }[] = [];
      let m: RegExpExecArray | null;
      while ((m = regex.exec(normText)) !== null) {
        const origStart = normToOrig[m.index];
        const origEnd = normToOrig[m.index + m[0].length] ?? fullText.length;
        matches.push({ start: origStart, end: origEnd });
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
          mark.setAttribute('data-search-mark', 'true');
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
  }, [currentPage, activeSearchTerm, loading]);

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

    const rects: { top: number; left: number; width: number; height: number }[] = [];
    const pw = pageRect.width;
    const ph = pageRect.height;

    // Use getClientRects from the range directly - filter out duplicates and
    // zero-size rects. For partial line selections, deduplicate by checking
    // if a rect is already substantially covered by another.
    const clientRects = range.getClientRects();
    const rawRects: DOMRect[] = [];
    for (let i = 0; i < clientRects.length; i++) {
      const r = clientRects[i];
      if (r.width < 1 || r.height < 1) continue;
      // Skip duplicate/nearly-identical rects
      const isDup = rawRects.some(
        (prev) =>
          Math.abs(prev.top - r.top) < 2 &&
          Math.abs(prev.left - r.left) < 2 &&
          Math.abs(prev.width - r.width) < 2 &&
          Math.abs(prev.height - r.height) < 2,
      );
      if (!isDup) rawRects.push(r);
    }

    for (const r of rawRects) {
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
  // Listen for selection end events (mouse + touch)
  useEffect(() => {
    const container = pageContainerRef.current;
    if (!container || !highlightMode) return;

    const onMouseUp = () => setTimeout(handleSelectionEnd, 50);
    
    // For touch: listen to selectionchange which fires after iOS/Android 
    // text selection handles are released
    let touchSelectionTimeout: ReturnType<typeof setTimeout> | null = null;
    const onSelectionChange = () => {
      if (touchSelectionTimeout) clearTimeout(touchSelectionTimeout);
      touchSelectionTimeout = setTimeout(() => {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          handleSelectionEnd();
        }
      }, 600);
    };

    const onTouchEnd = () => {
      // Give iOS time to finalize selection
      setTimeout(handleSelectionEnd, 500);
    };

    container.addEventListener('mouseup', onMouseUp);
    container.addEventListener('touchend', onTouchEnd);
    document.addEventListener('selectionchange', onSelectionChange);

    return () => {
      container.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('selectionchange', onSelectionChange);
      if (touchSelectionTimeout) clearTimeout(touchSelectionTimeout);
    };
  }, [highlightMode, handleSelectionEnd]);

  const isPercentRect = (r: { top: number; left: number; width: number; height: number }) =>
    r.top <= 100 && r.left <= 100 && r.width <= 100 && r.height <= 100;

  const mergeHighlightRects = (rects: { top: number; left: number; width: number; height: number }[]) => {
    if (rects.length <= 1) return rects.map((r) => ({ ...r, isPercent: isPercentRect(r) }));

    const allPercent = rects.every(isPercentRect);
    const allPx = rects.every((r) => !isPercentRect(r));
    if (!allPercent && !allPx) return rects.map((r) => ({ ...r, isPercent: isPercentRect(r) }));

    const yTolerance = allPercent ? 0.7 : 2;
    const hTolerance = allPercent ? 0.7 : 2;
    const xGapTolerance = allPercent ? 0.5 : 2;

    const sorted = [...rects].sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top));
    const lines: Array<{ top: number; bottom: number; height: number; segments: Array<[number, number]> }> = [];

    for (const r of sorted) {
      const bottom = r.top + r.height;
      let line = lines.find(
        (l) => Math.abs(l.top - r.top) <= yTolerance && Math.abs(l.height - r.height) <= hTolerance,
      );

      if (!line) {
        line = { top: r.top, bottom, height: r.height, segments: [] };
        lines.push(line);
      } else {
        line.top = Math.min(line.top, r.top);
        line.bottom = Math.max(line.bottom, bottom);
        line.height = line.bottom - line.top;
      }

      line.segments.push([r.left, r.left + r.width]);
    }

    return lines.flatMap((line) => {
      const segments = [...line.segments].sort((a, b) => a[0] - b[0]);
      const merged: Array<[number, number]> = [];

      for (const [start, end] of segments) {
        const last = merged[merged.length - 1];
        if (!last || start > last[1] + xGapTolerance) merged.push([start, end]);
        else last[1] = Math.max(last[1], end);
      }

      return merged.map(([start, end]) => ({
        top: line.top,
        left: start,
        width: Math.max(0, end - start),
        height: line.height,
        isPercent: allPercent,
      }));
    });
  };

  const pageAnnotations = annotations.filter((a) => a.page === currentPage);

  return (
    <div className={embedded ? "h-full flex flex-col bg-background" : "h-screen flex flex-col bg-background"}>
      {/* Top bar */}
      <header className="border-b border-border shrink-0 glass mt-[20px] sm:mt-0 md:mt-[20px] xl:mt-0">
        <div className="h-14 flex items-center justify-between px-2 sm:px-4 md:pl-[76px] xl:pl-4">
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
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(300, z + 10))}>
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={highlightMode ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setHighlightMode(!highlightMode);
                if (!highlightMode) setEraserMode(false);
              }}
              title="Modo grifo"
            >
              <Highlighter className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={eraserMode ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setEraserMode(!eraserMode);
                if (!eraserMode) setHighlightMode(false);
              }}
              title="Borracha - clique em um grifo para apagar"
            >
              <Eraser className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant={inDocSearch ? 'default' : 'ghost'}
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                setInDocSearch(!inDocSearch);
                if (inDocSearch) {
                  setInDocSearchTerm('');
                  setInDocResults([]);
                  setInDocResultIdx(0);
                }
              }}
              title="Pesquisar no documento"
            >
              <Search className="w-3.5 h-3.5" />
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

      {/* In-document search bar */}
      {inDocSearch && (
        <div className="h-12 border-b border-border flex items-center gap-2 px-3 shrink-0 bg-muted/50">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            ref={searchInputRef}
            value={inDocSearchTerm}
            onChange={(e) => setInDocSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (inDocResults.length > 0 && inDocSearchTerm.trim()) {
                  goToInDocResult(inDocResultIdx + 1);
                } else {
                  executeInDocSearch(inDocSearchTerm);
                }
              } else if (e.key === 'Escape') {
                setInDocSearch(false);
                setInDocSearchTerm('');
                setInDocResults([]);
              }
            }}
            placeholder="Pesquisar no documento..."
            className="h-8 text-sm flex-1"
          />
          {isSearching && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          {inDocResults.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {inDocResultIdx + 1}/{inDocResults.length}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToInDocResult(inDocResultIdx - 1)}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => goToInDocResult(inDocResultIdx + 1)}>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {inDocSearchTerm && inDocResults.length === 0 && !isSearching && (
            <span className="text-xs text-muted-foreground">Nenhum resultado</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => {
              setInDocSearch(false);
              setInDocSearchTerm('');
              setInDocResults([]);
            }}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {/* Highlight color bar */}
      {highlightMode && (
        <div className="min-h-[48px] border-b border-border flex items-center justify-center gap-2 sm:gap-3 px-2 shrink-0 bg-muted/50 flex-wrap py-1.5">
          <span className="text-xs text-muted-foreground">Cor:</span>
          <div className="flex gap-1.5 sm:gap-2">
            {highlightColors.map((c) => (
              <button
                key={c.name}
                className={`w-8 h-8 sm:w-7 sm:h-7 rounded-full border-2 transition-all ${
                  activeColor === c.color
                    ? 'scale-110 border-foreground shadow-md'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.color }}
                onClick={() => setActiveColor(c.color)}
                title={c.name}
              />
            ))}
          </div>
          {pageAnnotations.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 sm:h-7 text-destructive px-2"
              onClick={() => clearPageAnnotations(currentPage)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Limpar página</span>
              <span className="sm:hidden">Limpar</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-7 sm:w-7"
            onClick={() => setHighlightMode(false)}
          >
            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>
        </div>
      )}

      {/* Eraser mode bar */}
      {eraserMode && (
        <div className="min-h-[48px] border-b border-border flex items-center justify-center gap-2 sm:gap-3 px-2 shrink-0 bg-destructive/5 flex-wrap py-1.5">
          <Eraser className="w-4 h-4 text-destructive" />
          <span className="text-xs text-muted-foreground">Toque em um grifo para apagar</span>
          {pageAnnotations.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8 sm:h-7 text-destructive px-2"
              onClick={() => clearPageAnnotations(currentPage)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Limpar página</span>
              <span className="sm:hidden">Limpar</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-7 sm:w-7"
            onClick={() => setEraserMode(false)}
          >
            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main ref={mainRef} className="flex-1 bg-muted/30 overflow-auto p-4">
          {pdfUrl ? (
            <div className="relative mx-auto w-fit" ref={pageContainerRef}>
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
                  width={containerWidth && containerWidth < 700 ? containerWidth : undefined}
                  className="shadow-2xl rounded-lg"
                  renderTextLayer
                  renderAnnotationLayer
                />
              </Document>

              {/* Render persisted highlights overlay */}
              {pageAnnotations.map((h) => {
                const rects = h.position?.rects || [];
                if (rects.length === 0) return null;
                const bgColor = h.color.replace('hsl(', 'hsla(').replace(')', ', 0.4)');
                const mergedRects = mergeHighlightRects(rects);

                return (
                  <svg
                    key={h.id}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      overflow: 'visible',
                      zIndex: eraserMode ? 60 : undefined,
                      pointerEvents: eraserMode ? 'auto' : 'none',
                    }}
                  >
                    {mergedRects.map((r, i) => (
                      <rect
                        key={i}
                        x={r.isPercent ? `${r.left}%` : r.left}
                        y={r.isPercent ? `${r.top}%` : r.top}
                        width={r.isPercent ? `${r.width}%` : r.width}
                        height={r.isPercent ? `${r.height}%` : r.height}
                        rx="2"
                        fill={eraserMode ? bgColor.replace('0.4)', '0.6)') : bgColor}
                        stroke={eraserMode ? 'hsl(var(--destructive))' : 'none'}
                        strokeWidth={eraserMode ? '2' : '0'}
                        strokeDasharray={eraserMode ? '4 2' : 'none'}
                        style={{
                          pointerEvents: (eraserMode || highlightMode) ? 'auto' : 'none',
                          cursor: (eraserMode || highlightMode) ? 'pointer' : 'default',
                          transition: 'opacity 0.15s',
                          touchAction: eraserMode ? 'none' : undefined,
                        }}
                        onMouseEnter={(e) => { if (eraserMode) (e.target as SVGRectElement).style.opacity = '0.3'; }}
                        onMouseLeave={(e) => { if (eraserMode) (e.target as SVGRectElement).style.opacity = '1'; }}
                        onClick={(e) => {
                          if (eraserMode || highlightMode) {
                            e.stopPropagation();
                            removeAnnotation(h.id);
                          }
                        }}
                        onTouchEnd={(e) => {
                          if (eraserMode) {
                            e.preventDefault();
                            e.stopPropagation();
                            removeAnnotation(h.id);
                          }
                        }}
                      />
                    ))}
                  </svg>
                );
              })}

              {/* Tap zones for mobile navigation */}
              {totalPages > 1 && !highlightMode && !eraserMode && (
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
