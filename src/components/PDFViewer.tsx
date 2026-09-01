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
  PenLine,
  Type,
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

const drawColors = [
  { name: 'Preto', color: '#1a1a1a' },
  { name: 'Vermelho', color: '#ef4444' },
  { name: 'Azul', color: '#3b82f6' },
  { name: 'Verde', color: '#22c55e' },
  { name: 'Roxo', color: '#a855f7' },
];

export function PDFViewer({ doc, onBack, searchContext, embedded = false }: PDFViewerProps) {
  const isMobile = useIsMobile();
  const savedPage = searchContext ? 1 : (() => {
    try { return parseInt(localStorage.getItem(`pdf_page_${doc.id}`) || '1', 10) || 1; } catch { return 1; }
  })();
  const [currentPage, setCurrentPage] = useState(savedPage);

  useEffect(() => {
    try { localStorage.setItem(`pdf_page_${doc.id}`, String(currentPage)); } catch {}
  }, [currentPage, doc.id]);
  const [totalPages, setTotalPages] = useState(doc.pages || 1);
  const [zoom, setZoom] = useState(100);
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
  const [drawMode, setDrawMode] = useState(false);
  const [textMode, setTextMode] = useState(false);
  const [drawColor, setDrawColor] = useState('#1a1a1a');
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(3);
  const [textFontSize, setTextFontSize] = useState(14);
  const [pendingTextBox, setPendingTextBox] = useState<{ x: number; y: number } | null>(null);
  const [pendingText, setPendingText] = useState('');
  const [pageInputValue, setPageInputValue] = useState(String(savedPage));
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [draggingTextbox, setDraggingTextbox] = useState<{
    annId: string; startX: number; startY: number;
    origX: number; origY: number; currentX: number; currentY: number; didDrag: boolean;
  } | null>(null);
  const [editingTextbox, setEditingTextbox] = useState<{
    annId: string; x: number; y: number; content: string; fontSize: number; color: string;
  } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([]);
  const isDrawingRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const confirmButtonRef = useRef<HTMLDivElement>(null);
  const [pendingHighlight, setPendingHighlight] = useState<{
    rects: { top: number; left: number; width: number; height: number }[];
    text: string;
    btnX: number;
    btnY: number;
  } | null>(null);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);

  // Keep page input in sync when page changes via tap zones or arrow keys
  useEffect(() => { setPageInputValue(String(currentPage)); }, [currentPage]);

  // Scroll to top on page change
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [currentPage]);

  // Keyboard navigation (← →)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (drawMode || textMode) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentPage((p) => Math.min(totalPages, p + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [totalPages, drawMode, textMode]);

  // Size canvas to match PDF page on layout changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { clientWidth: w, clientHeight: h } = canvas;
    if (w > 0 && h > 0) { canvas.width = w; canvas.height = h; }
  }, [currentPage, zoom, containerWidth, loading]);

  // Focus textarea when a new pending text box is created
  useEffect(() => {
    if (pendingTextBox) textareaRef.current?.focus();
  }, [pendingTextBox]);

  // Focus and select all when editing an existing text box
  useEffect(() => {
    if (editingTextbox) { editTextareaRef.current?.focus(); editTextareaRef.current?.select(); }
  }, [editingTextbox?.annId]);

  // Cancel drag when leaving text mode
  useEffect(() => {
    if (!textMode) setDraggingTextbox(null);
  }, [textMode]);

  const { annotations, addAnnotation, addDrawing, addTextBox, updateAnnotation, removeAnnotation, clearPageAnnotations } = useDocumentAnnotations(doc.id);

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

    const maxBottom = Math.max(...rects.map((r) => r.top + r.height));
    const minTop = Math.min(...rects.map((r) => r.top));
    const centerX = rects.reduce((sum, r) => sum + r.left + r.width / 2, 0) / rects.length;

    setPendingHighlight({
      rects,
      text: selection.toString().trim(),
      btnX: Math.min(84, Math.max(1, centerX - 8)),
      btnY: maxBottom > 88 ? Math.max(0, minTop - 12) : maxBottom + 2,
    });
  }, [highlightMode, setPendingHighlight]);

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
        <div className="h-14 flex items-center justify-between px-2 sm:px-4 md:pl-[76px] xl:pl-4 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 h-9 w-9 sm:h-9 sm:w-9 touch-target">
              <ArrowLeft className="w-5 h-5 sm:w-5 sm:h-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-xs sm:text-sm font-semibold truncate">{doc.title}</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{doc.author}</p>
            </div>
          </div>

          {/* Mobile: compact toolbar with overflow sheet */}
          <div className="flex items-center gap-0.5 shrink-0 sm:hidden">
            <Button
              variant={highlightMode ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9 touch-target"
              onClick={() => {
                const entering = !highlightMode;
                setHighlightMode(entering);
                if (!entering) setPendingHighlight(null);
                if (entering) { setEraserMode(false); setDrawMode(false); setTextMode(false); }
              }}
              title="Modo grifo"
            >
              <Highlighter className="w-4 h-4" />
            </Button>
            <Button
              variant={inDocSearch ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9 touch-target"
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
              <Search className="w-4 h-4" />
            </Button>
            <Sheet open={toolsSheetOpen} onOpenChange={setToolsSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 touch-target" title="Mais ferramentas">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl pb-8 pt-3 px-4">
                <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-3" />
                <SheetHeader className="text-left mb-3">
                  <SheetTitle className="text-base">Ferramentas</SheetTitle>
                </SheetHeader>

                {/* Zoom group */}
                <div className="bg-secondary/50 rounded-xl p-3 mb-3">
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Zoom</p>
                  <div className="flex items-center justify-between gap-2">
                    <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
                      <ZoomOut className="w-5 h-5" />
                    </Button>
                    <span className="text-base font-semibold flex-1 text-center">{zoom}%</span>
                    <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setZoom((z) => Math.min(300, z + 10))}>
                      <ZoomIn className="w-5 h-5" />
                    </Button>
                  </div>
                </div>

                {/* Tool actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={drawMode ? 'default' : 'outline'}
                    className="h-12 justify-start gap-2"
                    onClick={() => {
                      const entering = !drawMode;
                      setDrawMode(entering);
                      if (entering) { setHighlightMode(false); setEraserMode(false); setTextMode(false); setPendingHighlight(null); }
                      setToolsSheetOpen(false);
                    }}
                  >
                    <PenLine className="w-4 h-4" />
                    <span className="text-sm">Desenhar</span>
                  </Button>
                  <Button
                    variant={textMode ? 'default' : 'outline'}
                    className="h-12 justify-start gap-2"
                    onClick={() => {
                      const entering = !textMode;
                      setTextMode(entering);
                      if (entering) { setHighlightMode(false); setEraserMode(false); setDrawMode(false); }
                      setToolsSheetOpen(false);
                    }}
                  >
                    <Type className="w-4 h-4" />
                    <span className="text-sm">Texto</span>
                  </Button>
                  <Button
                    variant={eraserMode ? 'default' : 'outline'}
                    className="h-12 justify-start gap-2"
                    onClick={() => {
                      const entering = !eraserMode;
                      setEraserMode(entering);
                      if (entering) { setHighlightMode(false); setDrawMode(false); setTextMode(false); setPendingHighlight(null); }
                      setToolsSheetOpen(false);
                    }}
                  >
                    <Eraser className="w-4 h-4" />
                    <span className="text-sm">Borracha</span>
                  </Button>
                  {pdfUrl && (
                    <Button variant="outline" className="h-12 justify-start gap-2" asChild>
                      <a href={pdfUrl} download={doc.fileName} target="_blank" rel="noopener noreferrer" onClick={() => setToolsSheetOpen(false)}>
                        <Download className="w-4 h-4" />
                        <span className="text-sm">Baixar</span>
                      </a>
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop / iPad: full toolbar */}
          <div className="hidden sm:flex items-center gap-0.5 sm:gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setZoom((z) => Math.max(50, z - 10))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <button
              onClick={() => setZoom(100)}
              title="Resetar zoom para 100%"
              className="text-xs text-muted-foreground w-12 text-center font-medium hover:text-foreground transition-colors"
            >{zoom}%</button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setZoom((z) => Math.min(300, z + 10))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <div className="w-px h-5 bg-border mx-1" />
            <Button
              variant={highlightMode ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                const entering = !highlightMode;
                setHighlightMode(entering);
                if (!entering) setPendingHighlight(null);
                if (entering) { setEraserMode(false); setDrawMode(false); setTextMode(false); }
              }}
              title="Modo grifo"
            >
              <Highlighter className="w-4 h-4" />
            </Button>
            <Button
              variant={drawMode ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                const entering = !drawMode;
                setDrawMode(entering);
                if (entering) { setHighlightMode(false); setEraserMode(false); setTextMode(false); setPendingHighlight(null); }
              }}
              title="Modo desenho"
            >
              <PenLine className="w-4 h-4" />
            </Button>
            <Button
              variant={textMode ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                const entering = !textMode;
                setTextMode(entering);
                if (entering) { setHighlightMode(false); setEraserMode(false); setDrawMode(false); }
              }}
              title="Inserir texto"
            >
              <Type className="w-4 h-4" />
            </Button>
            <Button
              variant={eraserMode ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                const entering = !eraserMode;
                setEraserMode(entering);
                if (entering) { setHighlightMode(false); setDrawMode(false); setTextMode(false); setPendingHighlight(null); }
              }}
              title="Borracha — toque em uma anotação para apagar"
            >
              <Eraser className="w-4 h-4" />
            </Button>
            <Button
              variant={inDocSearch ? 'default' : 'ghost'}
              size="icon"
              className="h-9 w-9"
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
              <Search className="w-4 h-4" />
            </Button>
            {pdfUrl && (
              <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
                <a href={pdfUrl} download={doc.fileName} target="_blank" rel="noopener noreferrer">
                  <Download className="w-4 h-4" />
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
          <span className="text-xs text-muted-foreground">Toque em uma anotação para apagar</span>
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
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => setEraserMode(false)}>
            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>
        </div>
      )}

      {/* Draw mode bar */}
      {drawMode && (
        <div className="min-h-[48px] border-b border-border flex items-center justify-center gap-2 sm:gap-3 px-2 shrink-0 bg-muted/50 flex-wrap py-1.5">
          <PenLine className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Desenhar</span>
          <div className="flex gap-1.5">
            {drawColors.map((c) => (
              <button
                key={c.name}
                className={`w-8 h-8 sm:w-7 sm:h-7 rounded-full border-2 transition-all ${drawColor === c.color ? 'scale-110 border-foreground shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c.color }}
                onClick={() => setDrawColor(c.color)}
                title={c.name}
              />
            ))}
          </div>
          <div className="flex gap-1">
            {([2, 3, 5] as const).map((w, i) => (
              <button
                key={w}
                className={`px-2 h-8 sm:h-7 rounded text-xs border transition-colors ${drawStrokeWidth === w ? 'bg-foreground text-background border-foreground' : 'bg-transparent border-border hover:bg-secondary/80'}`}
                onClick={() => setDrawStrokeWidth(w)}
                title={['Fino', 'Médio', 'Grosso'][i]}
              >
                {['F', 'M', 'G'][i]}
              </button>
            ))}
          </div>
          <div className="w-px h-4 bg-border/60 mx-1 shrink-0" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 sm:h-7 sm:w-7 text-destructive"
            title="Borracha — apagar anotações"
            onClick={() => { setDrawMode(false); setEraserMode(true); }}
          >
            <Eraser className="w-4 h-4" />
          </Button>
          {pageAnnotations.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-8 sm:h-7 text-destructive px-2" onClick={() => clearPageAnnotations(currentPage)}>
              <Trash2 className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Limpar página</span>
              <span className="sm:hidden">Limpar</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => setDrawMode(false)}>
            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>
        </div>
      )}

      {/* Text mode bar */}
      {textMode && (
        <div className="min-h-[48px] border-b border-border flex items-center justify-center gap-2 sm:gap-3 px-2 shrink-0 bg-muted/50 flex-wrap py-1.5">
          <Type className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-muted-foreground shrink-0">Clique na página para inserir texto</span>
          <div className="flex gap-1.5">
            {drawColors.map((c) => (
              <button
                key={c.name}
                className={`w-8 h-8 sm:w-7 sm:h-7 rounded-full border-2 transition-all ${drawColor === c.color ? 'scale-110 border-foreground shadow-md' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c.color }}
                onClick={() => setDrawColor(c.color)}
                title={c.name}
              />
            ))}
          </div>
          <div className="flex gap-1">
            {([12, 16, 22] as const).map((sz, i) => (
              <button
                key={sz}
                className={`px-2 h-8 sm:h-7 rounded text-xs border transition-colors ${textFontSize === sz ? 'bg-foreground text-background border-foreground' : 'bg-transparent border-border hover:bg-secondary/80'}`}
                onClick={() => setTextFontSize(sz)}
                title={['Pequeno', 'Médio', 'Grande'][i]}
              >
                {['P', 'M', 'G'][i]}
              </button>
            ))}
          </div>
          {pageAnnotations.length > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-8 sm:h-7 text-destructive px-2" onClick={() => clearPageAnnotations(currentPage)}>
              <Trash2 className="w-3 h-3 mr-1" />
              <span className="hidden sm:inline">Limpar página</span>
              <span className="sm:hidden">Limpar</span>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7" onClick={() => setTextMode(false)}>
            <X className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main ref={mainRef} className="flex-1 bg-muted/30 overflow-auto p-4">
          {pdfUrl ? (
            <div
              className="relative mx-auto w-fit"
              ref={pageContainerRef}
              style={{ cursor: textMode ? 'text' : undefined }}
              onMouseDown={pendingHighlight ? (e) => {
                if (!confirmButtonRef.current?.contains(e.target as Node)) {
                  setPendingHighlight(null);
                }
              } : undefined}
              onClick={textMode ? (e) => {
                if ((e.target as HTMLElement).tagName === 'TEXTAREA') return;
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                setPendingText('');
                setPendingTextBox({ x, y });
              } : undefined}
            >
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

              {/* Render persisted annotations overlay */}
              {pageAnnotations.map((ann) => {
                const pos = ann.position as any;
                if (!pos) return null;

                if (pos.type === 'drawing') {
                  return (
                    <svg
                      key={ann.id}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        overflow: 'visible', zIndex: eraserMode ? 60 : 10,
                        pointerEvents: eraserMode ? 'auto' : 'none',
                        cursor: eraserMode ? 'pointer' : 'default',
                        filter: eraserMode ? 'drop-shadow(0 0 4px #ef4444)' : 'none',
                        opacity: eraserMode ? 0.7 : 1,
                      }}
                      onClick={(e) => { if (eraserMode) { e.stopPropagation(); removeAnnotation(ann.id); } }}
                      onTouchEnd={(e) => { if (eraserMode) { e.preventDefault(); e.stopPropagation(); removeAnnotation(ann.id); } }}
                    >
                      {(pos.strokes as { x: number; y: number }[][]).map((stroke: { x: number; y: number }[], si: number) => (
                        <polyline
                          key={si}
                          points={stroke.map((p: { x: number; y: number }) => `${p.x},${p.y}`).join(' ')}
                          fill="none"
                          stroke={eraserMode ? '#ef4444' : (pos.color || ann.color)}
                          strokeWidth={pos.strokeWidth || 3}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          vectorEffect="non-scaling-stroke"
                        />
                      ))}
                    </svg>
                  );
                }

                if (pos.type === 'textbox') {
                  const isEditing = editingTextbox?.annId === ann.id;
                  const isDragging = draggingTextbox?.annId === ann.id;
                  const displayX = isDragging ? draggingTextbox!.currentX : pos.x;
                  const displayY = isDragging ? draggingTextbox!.currentY : pos.y;

                  if (isEditing) {
                    return (
                      <textarea
                        key={ann.id}
                        ref={editTextareaRef}
                        value={editingTextbox!.content}
                        onChange={(e) => setEditingTextbox((prev) => prev ? { ...prev, content: e.target.value } : null)}
                        onBlur={async () => {
                          const et = editingTextbox!;
                          setEditingTextbox(null);
                          await updateAnnotation(et.annId, { ...pos, content: et.content });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
                          if (e.key === 'Escape') setEditingTextbox(null);
                        }}
                        style={{
                          position: 'absolute', left: `${pos.x}%`, top: `${pos.y}%`, zIndex: 30,
                          minWidth: '120px', minHeight: '36px', resize: 'both',
                          border: `2px dashed ${pos.color || ann.color}`, borderRadius: '3px',
                          background: 'rgba(255,255,255,0.92)', color: pos.color || ann.color,
                          fontSize: `${pos.fontSize || 14}px`, padding: '3px 6px', outline: 'none',
                          fontFamily: 'sans-serif', lineHeight: '1.4',
                        }}
                      />
                    );
                  }

                  return (
                    <div
                      key={ann.id}
                      style={{
                        position: 'absolute',
                        left: `${displayX}%`,
                        top: `${displayY}%`,
                        color: pos.color || ann.color,
                        fontSize: `${pos.fontSize || 14}px`,
                        zIndex: (eraserMode || textMode) ? 60 : 10,
                        whiteSpace: 'pre-wrap',
                        pointerEvents: (eraserMode || textMode) ? 'auto' : 'none',
                        cursor: eraserMode ? 'pointer' : (textMode ? (isDragging ? 'grabbing' : 'grab') : 'default'),
                        userSelect: 'none',
                        fontFamily: 'sans-serif',
                        lineHeight: '1.4',
                        padding: '2px 4px',
                        border: eraserMode ? '1px dashed #ef4444' : (textMode ? '1px dashed rgba(0,0,0,0.25)' : 'none'),
                        borderRadius: '2px',
                        maxWidth: '60%',
                        wordBreak: 'break-word',
                        background: eraserMode ? 'rgba(255,255,255,0.8)' : (textMode ? 'rgba(255,255,255,0.05)' : 'transparent'),
                        touchAction: textMode ? 'none' : 'auto',
                      }}
                      onClick={(e) => {
                        if (eraserMode) { e.stopPropagation(); removeAnnotation(ann.id); return; }
                        if (textMode) e.stopPropagation();
                      }}
                      onDoubleClick={textMode && !eraserMode ? (e) => {
                        e.stopPropagation();
                        setEditingTextbox({ annId: ann.id, x: pos.x, y: pos.y, content: pos.content, fontSize: pos.fontSize || 14, color: pos.color || ann.color });
                      } : undefined}
                      onTouchEnd={(e) => { if (eraserMode) { e.preventDefault(); e.stopPropagation(); removeAnnotation(ann.id); } }}
                      onPointerDown={textMode && !eraserMode ? (e) => {
                        e.stopPropagation();
                        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                        setDraggingTextbox({ annId: ann.id, startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y, currentX: pos.x, currentY: pos.y, didDrag: false });
                      } : undefined}
                      onPointerMove={textMode && !eraserMode && draggingTextbox?.annId === ann.id ? (e) => {
                        const container = pageContainerRef.current;
                        if (!container || !draggingTextbox) return;
                        const rect = container.getBoundingClientRect();
                        const dx = ((e.clientX - draggingTextbox.startX) / rect.width) * 100;
                        const dy = ((e.clientY - draggingTextbox.startY) / rect.height) * 100;
                        setDraggingTextbox((prev) => prev ? {
                          ...prev,
                          currentX: Math.max(0, Math.min(90, prev.origX + dx)),
                          currentY: Math.max(0, Math.min(95, prev.origY + dy)),
                          didDrag: Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5,
                        } : null);
                      } : undefined}
                      onPointerUp={textMode && !eraserMode ? async (e) => {
                        if (!draggingTextbox || draggingTextbox.annId !== ann.id) return;
                        const dt = draggingTextbox;
                        setDraggingTextbox(null);
                        if (dt.didDrag) {
                          await updateAnnotation(ann.id, { ...pos, x: dt.currentX, y: dt.currentY });
                        }
                      } : undefined}
                    >
                      {pos.content}
                    </div>
                  );
                }

                // Default: highlight (has rects)
                const rects = pos.rects || [];
                if (rects.length === 0) return null;
                const bgColor = ann.color.replace('hsl(', 'hsla(').replace(')', ', 0.4)');
                const mergedRects = mergeHighlightRects(rects);

                return (
                  <svg
                    key={ann.id}
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
                            removeAnnotation(ann.id);
                          }
                        }}
                        onTouchEnd={(e) => {
                          if (eraserMode) {
                            e.preventDefault();
                            e.stopPropagation();
                            removeAnnotation(ann.id);
                          }
                        }}
                      />
                    ))}
                  </svg>
                );
              })}

              {/* Highlight confirm button — appears after text selection */}
              {highlightMode && pendingHighlight && (
                <div
                  ref={confirmButtonRef}
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: `${pendingHighlight.btnX}%`,
                    top: `${pendingHighlight.btnY}%`,
                    zIndex: 40,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'white',
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: '8px',
                    padding: '5px 10px 5px 7px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {highlightColors.map((c) => (
                    <button
                      key={c.name}
                      title={c.name}
                      style={{
                        width: '18px', height: '18px', borderRadius: '50%',
                        background: c.color,
                        border: activeColor === c.color ? '2.5px solid #111' : '2px solid rgba(0,0,0,0.1)',
                        cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s',
                        transform: activeColor === c.color ? 'scale(1.15)' : 'scale(1)',
                      }}
                      onClick={(e) => { e.stopPropagation(); setActiveColor(c.color); }}
                    />
                  ))}
                  <div style={{ width: '1px', height: '16px', background: 'rgba(0,0,0,0.12)', margin: '0 2px' }} />
                  <button
                    style={{ fontSize: '12px', fontWeight: 600, color: '#111', cursor: 'pointer', background: 'none', border: 'none', padding: '0 2px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      addAnnotation({ page: currentPage, color: activeColor, rects: pendingHighlight.rects, text: pendingHighlight.text });
                      setPendingHighlight(null);
                      window.getSelection()?.removeAllRanges();
                    }}
                  >
                    Grifar
                  </button>
                  <button
                    style={{ fontSize: '11px', color: '#888', cursor: 'pointer', background: 'none', border: 'none', padding: '0', lineHeight: 1 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingHighlight(null);
                      window.getSelection()?.removeAllRanges();
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Drawing canvas — real-time preview during stroke */}
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  zIndex: 20,
                  cursor: drawMode ? 'crosshair' : 'default',
                  pointerEvents: drawMode ? 'auto' : 'none',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  if (!drawMode) return;
                  const canvas = e.currentTarget;
                  // Ensure canvas pixel size matches layout
                  if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
                    canvas.width = canvas.clientWidth;
                    canvas.height = canvas.clientHeight;
                  }
                  canvas.setPointerCapture(e.pointerId);
                  const rect = canvas.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  currentStrokeRef.current = [{ x, y }];
                  isDrawingRef.current = true;
                }}
                onPointerMove={(e) => {
                  if (!drawMode || !isDrawingRef.current) return;
                  const canvas = e.currentTarget;
                  const rect = canvas.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  const stroke = currentStrokeRef.current;
                  const prev = stroke[stroke.length - 1];
                  stroke.push({ x, y });
                  const ctx = canvas.getContext('2d');
                  if (!ctx || !prev) return;
                  ctx.beginPath();
                  ctx.strokeStyle = drawColor;
                  ctx.lineWidth = drawStrokeWidth;
                  ctx.lineCap = 'round';
                  ctx.lineJoin = 'round';
                  ctx.moveTo((prev.x / 100) * canvas.width, (prev.y / 100) * canvas.height);
                  ctx.lineTo((x / 100) * canvas.width, (y / 100) * canvas.height);
                  ctx.stroke();
                }}
                onPointerUp={async (e) => {
                  if (!drawMode || !isDrawingRef.current) return;
                  isDrawingRef.current = false;
                  const stroke = [...currentStrokeRef.current];
                  currentStrokeRef.current = [];
                  const canvas = e.currentTarget;
                  canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
                  if (stroke.length < 2) return;
                  await addDrawing({ page: currentPage, strokes: [stroke], strokeWidth: drawStrokeWidth, color: drawColor });
                }}
                onPointerCancel={() => {
                  isDrawingRef.current = false;
                  currentStrokeRef.current = [];
                  const canvas = canvasRef.current;
                  if (canvas) canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
                }}
              />

              {/* Pending text box input */}
              {textMode && pendingTextBox && (
                <textarea
                  ref={textareaRef}
                  value={pendingText}
                  onChange={(e) => setPendingText(e.target.value)}
                  onBlur={async () => {
                    const content = pendingText.trim();
                    const pos = pendingTextBox;
                    setPendingTextBox(null);
                    setPendingText('');
                    if (content && pos) {
                      await addTextBox({ page: currentPage, x: pos.x, y: pos.y, content, fontSize: textFontSize, color: drawColor });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.target as HTMLTextAreaElement).blur(); }
                    if (e.key === 'Escape') { setPendingTextBox(null); setPendingText(''); }
                  }}
                  placeholder="Digite aqui..."
                  style={{
                    position: 'absolute',
                    left: `${pendingTextBox.x}%`,
                    top: `${pendingTextBox.y}%`,
                    zIndex: 30,
                    minWidth: '120px',
                    minHeight: '36px',
                    resize: 'both',
                    border: `2px dashed ${drawColor}`,
                    borderRadius: '3px',
                    background: 'rgba(255,255,255,0.92)',
                    color: drawColor,
                    fontSize: `${textFontSize}px`,
                    padding: '3px 6px',
                    outline: 'none',
                    fontFamily: 'sans-serif',
                    lineHeight: '1.4',
                  }}
                />
              )}

              {/* Tap zones for mobile navigation */}
              {totalPages > 1 && !highlightMode && !eraserMode && !drawMode && !textMode && (
                <>
                  <button
                    className="absolute left-0 top-0 h-full cursor-pointer"
                    style={{ width: '10%', zIndex: 50, opacity: 0, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    aria-label="Página anterior"
                  />
                  <button
                    className="absolute right-0 top-0 h-full cursor-pointer"
                    style={{ width: '10%', zIndex: 50, opacity: 0, WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
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
      <footer className="h-14 sm:h-12 border-t border-border flex items-center justify-center gap-2 sm:gap-3 shrink-0 mb-[20px] px-3 bg-background/95 backdrop-blur">
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 sm:h-8 sm:w-8 touch-target"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="w-5 h-5 sm:w-4 sm:h-4" />
        </Button>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/60 min-w-[120px] justify-center">
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={pageInputValue}
            onChange={(e) => setPageInputValue(e.target.value)}
            onBlur={() => {
              const n = parseInt(pageInputValue, 10);
              if (n >= 1 && n <= totalPages) setCurrentPage(n);
              else setPageInputValue(String(currentPage));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const n = parseInt(pageInputValue, 10);
                if (n >= 1 && n <= totalPages) setCurrentPage(n);
                else setPageInputValue(String(currentPage));
                (e.target as HTMLInputElement).blur();
              }
            }}
            className="h-7 w-12 text-center text-sm font-semibold border-0 bg-transparent p-0 focus-visible:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-sm text-muted-foreground">/ {totalPages}</span>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 sm:h-8 sm:w-8 touch-target"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          <ChevronRight className="w-5 h-5 sm:w-4 sm:h-4" />
        </Button>
      </footer>
    </div>
  );
}
