import { useRef, useCallback, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  Type,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { detectLastScriptureReference, ScriptureRef } from '@/lib/scripture-parser';
import { fetchVerses, formatVersesAsHtml } from '@/lib/bible-fetch';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  fillHeight?: boolean;
}

const fontFamilies = [
  { label: 'Sans-serif', value: 'sans-serif' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'monospace' },
  { label: 'Georgia', value: 'Georgia' },
  { label: 'Arial', value: 'Arial' },
  { label: 'Times New Roman', value: 'Times New Roman' },
];

const fontSizes = [
  { label: '12', value: '1' },
  { label: '14', value: '2' },
  { label: '16', value: '3' },
  { label: '18', value: '4' },
  { label: '24', value: '5' },
  { label: '32', value: '6' },
  { label: '48', value: '7' },
];

export function RichTextEditor({ value, onChange, placeholder, fillHeight = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [scripturePopup, setScripturePopup] = useState<{
    ref: ScriptureRef;
    top: number;
    left: number;
  } | null>(null);
  const [inserting, setInserting] = useState(false);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    if (editorRef.current.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  }, []);

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || !savedRangeRef.current) return;
    sel.removeAllRanges();
    sel.addRange(savedRangeRef.current);
  }, []);

  const exec = useCallback((command: string, val?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, val);
    saveSelection();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange, restoreSelection, saveSelection]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    saveSelection();
  }, [onChange, saveSelection]);

  const handleRef = useCallback((el: HTMLDivElement | null) => {
    (editorRef as any).current = el;
    if (el && !isInitialized.current) {
      el.innerHTML = value;
      isInitialized.current = true;
    }
  }, [value]);

  const applyBlock = useCallback((tag: 'h1' | 'h2' | 'p') => {
    editorRef.current?.focus();
    restoreSelection();
    const candidates = [`<${tag}>`, tag.toUpperCase(), tag];
    let applied = false;
    for (const candidate of candidates) {
      applied = document.execCommand('formatBlock', false, candidate);
      if (applied) break;
    }
    if (!applied && tag === 'p') {
      document.execCommand('formatBlock', false, 'P');
    }
    saveSelection();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange, restoreSelection, saveSelection]);

  // Detect scripture references near cursor
  const detectScripture = useCallback(() => {
    if (!editorRef.current || !containerRef.current) return;

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) { setScripturePopup(null); return; }

    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) {
      setScripturePopup(null);
      return;
    }

    // Get text content of the current text node or nearby text
    let textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      // Try to find a text node child
      if (textNode.childNodes.length > 0 && range.startOffset > 0) {
        const child = textNode.childNodes[range.startOffset - 1];
        if (child?.nodeType === Node.TEXT_NODE) textNode = child;
        else if (child?.textContent) {
          const ref = detectLastScriptureReference(child.textContent);
          if (ref) {
            const rect = range.getBoundingClientRect();
            const containerRect = containerRef.current.getBoundingClientRect();
            setScripturePopup({
              ref,
              top: rect.bottom - containerRect.top + 4,
              left: rect.left - containerRect.left,
            });
            return;
          }
        }
      }
      setScripturePopup(null);
      return;
    }

    const textBefore = (textNode.textContent || '').slice(0, range.startOffset);
    // Check the last ~80 chars for a reference
    const snippet = textBefore.slice(-80);
    const ref = detectLastScriptureReference(snippet);

    if (ref) {
      const rect = range.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      setScripturePopup({
        ref,
        top: rect.bottom - containerRect.top + 4,
        left: Math.max(0, rect.left - containerRect.left),
      });
    } else {
      setScripturePopup(null);
    }
  }, []);

  const debouncedDetect = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(detectScripture, 500);
  }, [detectScripture]);

  // Cleanup debounce
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleKeyUp = useCallback((e: React.KeyboardEvent) => {
    saveSelection();
    debouncedDetect();
  }, [saveSelection, debouncedDetect]);

  const insertVerses = useCallback(async () => {
    if (!scripturePopup || !editorRef.current) return;
    const { ref } = scripturePopup;
    setInserting(true);
    try {
      const { bookName, verses } = await fetchVerses(
        ref.bookAbbrev,
        ref.chapter,
        ref.verse,
        ref.verseEnd
      );
      const html = formatVersesAsHtml(bookName, ref.chapter, verses);

      editorRef.current.focus();
      restoreSelection();

      // Move cursor to end of current line, then insert
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        r.collapse(false);
        // Insert after the current block
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const frag = document.createDocumentFragment();
        while (tempDiv.firstChild) frag.appendChild(tempDiv.firstChild);
        r.insertNode(frag);
        // Move cursor after inserted content
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
      }

      saveSelection();
      onChange(editorRef.current.innerHTML);
      setScripturePopup(null);
    } catch (err) {
      console.error('Error fetching verses:', err);
    } finally {
      setInserting(false);
    }
  }, [scripturePopup, restoreSelection, saveSelection, onChange]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "border border-input rounded-md overflow-hidden bg-background relative",
        fillHeight && "flex flex-col flex-1 min-h-0"
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-input bg-muted/30">
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} title="Negrito">
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} title="Itálico">
          <Italic className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
          onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('h1')} title="Título 1">
          <Heading1 className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
          onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('h2')} title="Título 2">
          <Heading2 className="w-3.5 h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
          onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('p')} title="Corpo">
          <Type className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        <Select onValueChange={(v) => exec('fontName', v)}>
          <SelectTrigger className="h-7 w-[110px] text-xs">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            {fontFamilies.map((f) => (
              <SelectItem key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select onValueChange={(v) => exec('fontSize', v)}>
          <SelectTrigger className="h-7 w-[70px] text-xs">
            <SelectValue placeholder="Tam." />
          </SelectTrigger>
          <SelectContent>
            {fontSizes.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}px</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Editable area */}
      <div
        ref={handleRef}
        contentEditable
        onInput={handleInput}
        onMouseUp={() => { saveSelection(); debouncedDetect(); }}
        onKeyUp={handleKeyUp}
        onBlur={() => { saveSelection(); setTimeout(() => setScripturePopup(null), 200); }}
        data-placeholder={placeholder}
        className={cn(
          "overflow-y-auto p-3 text-sm focus:outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground/50 max-w-none [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:mb-2 [&_p]:text-sm [&_p]:font-normal [&_p]:leading-relaxed",
          fillHeight ? "min-h-[200px] flex-1" : "min-h-[300px] max-h-[50vh]"
        )}
        style={{ wordBreak: 'break-word' }}
      />

      {/* Scripture insert popup */}
      {scripturePopup && (
        <div
          className="absolute z-50 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{
            top: scripturePopup.top,
            left: scripturePopup.left,
          }}
        >
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs shadow-md border border-border"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertVerses}
            disabled={inserting}
          >
            {inserting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BookOpen className="w-3.5 h-3.5" />
            )}
            Inserir {scripturePopup.ref.bookName} {scripturePopup.ref.chapter}:{scripturePopup.ref.verse}
            {scripturePopup.ref.verseEnd ? `-${scripturePopup.ref.verseEnd}` : ''}
          </Button>
        </div>
      )}
    </div>
  );
}
