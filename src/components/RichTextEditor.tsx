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
  FileText,
} from 'lucide-react';
import { detectLastScriptureReference, ScriptureRef } from '@/lib/scripture-parser';
import { fetchVerses, formatVersesAsHtml } from '@/lib/bible-fetch';
import { detectMsgReference, searchMsgDocuments, formatMsgAsHtml, MsgRef, MsgMatch } from '@/lib/msg-reference';

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

  // Scripture popup
  const [scripturePopup, setScripturePopup] = useState<{
    ref: ScriptureRef;
    top: number;
    left: number;
  } | null>(null);

  // MSG popup
  const [msgPopup, setMsgPopup] = useState<{
    ref: MsgRef;
    top: number;
    left: number;
  } | null>(null);
  const [msgMatches, setMsgMatches] = useState<MsgMatch[] | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);

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

  // Get text near cursor for detection
  const getTextNearCursor = useCallback((): { text: string; rect: DOMRect } | null => {
    if (!editorRef.current || !containerRef.current) return null;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editorRef.current.contains(range.commonAncestorContainer)) return null;

    const caretRange = range.cloneRange();
    caretRange.collapse(true);

    let rect = caretRange.getBoundingClientRect();
    if (!rect.width && !rect.height) {
      const marker = document.createElement('span');
      marker.textContent = '\u200b';
      marker.style.display = 'inline-block';
      marker.style.width = '0';
      marker.style.overflow = 'hidden';
      caretRange.insertNode(marker);
      rect = marker.getBoundingClientRect();
      marker.remove();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    let textNode = range.startContainer;
    if (textNode.nodeType !== Node.TEXT_NODE) {
      if (textNode.childNodes.length > 0 && range.startOffset > 0) {
        const child = textNode.childNodes[range.startOffset - 1];
        if (child?.nodeType === Node.TEXT_NODE) textNode = child;
        else if (child?.textContent) {
          return { text: child.textContent, rect };
        }
      }
      return null;
    }

    const textBefore = (textNode.textContent || '').slice(0, range.startOffset);
    return { text: textBefore, rect };
  }, []);

  // Detect scripture or MSG references near cursor
  const detectReferences = useCallback(() => {
    const cursorInfo = getTextNearCursor();
    if (!cursorInfo || !containerRef.current) {
      setScripturePopup(null);
      setMsgPopup(null);
      setMsgMatches(null);
      return;
    }

    const { text, rect } = cursorInfo;
    const containerRect = containerRef.current.getBoundingClientRect();
    const popupWidth = 320;
    const popupHeight = 36;
    const gutter = 8;

    const relativeLeft = rect.left - containerRect.left;
    const relativeTop = rect.top - containerRect.top;
    const relativeBottom = rect.bottom - containerRect.top;

    const left = Math.max(
      gutter,
      Math.min(relativeLeft + 12, containerRect.width - popupWidth - gutter)
    );

    const top = relativeTop > popupHeight + gutter
      ? relativeTop - popupHeight - 6
      : Math.min(relativeBottom + 6, containerRect.height - popupHeight - gutter);

    // Check MSG first (higher priority)
    const snippet = text.slice(-200);
    const msgRef = detectMsgReference(snippet);
    if (msgRef) {
      setScripturePopup(null);
      setMsgPopup({ ref: msgRef, top, left });
      return;
    }

    // Then check scripture
    const scriptSnippet = text.slice(-80);
    const ref = detectLastScriptureReference(scriptSnippet);
    if (ref) {
      setMsgPopup(null);
      setMsgMatches(null);
      setScripturePopup({ ref, top, left });
    } else {
      setScripturePopup(null);
      setMsgPopup(null);
      setMsgMatches(null);
    }
  }, [getTextNearCursor]);

  const debouncedDetect = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(detectReferences, 500);
  }, [detectReferences]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleKeyUp = useCallback((_e: React.KeyboardEvent) => {
    saveSelection();
    debouncedDetect();
  }, [saveSelection, debouncedDetect]);

  // Replace the reference text in the editor with the given HTML
  const replaceReferenceAndInsert = useCallback((referenceText: string, html: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;

    // Find the reference text in the editor's text content and remove it
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let found = false;

    // Normalize the reference for comparison
    const refNorm = referenceText.trim();

    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const idx = node.textContent?.indexOf(refNorm) ?? -1;
      if (idx !== -1) {
        // Check if this text node is the whole line or part of it
        
        // Create a range to replace
        const range = document.createRange();
        
        // If the node is essentially just the reference (maybe with whitespace), remove the parent block
        const parentBlock = node.parentElement?.closest('p, div, li') || node.parentElement;
        const blockText = parentBlock?.textContent?.trim() || '';
        
        if (blockText === refNorm || blockText === refNorm + '\n' || blockText === '\n' + refNorm) {
          // The entire block is just the reference — replace the whole block
          range.selectNode(parentBlock!);
        } else {
          // Only part of the block — remove just the reference text
          range.setStart(node, idx);
          range.setEnd(node, idx + refNorm.length);
        }

        range.deleteContents();

        // Insert HTML at the position
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const frag = document.createDocumentFragment();
        while (tempDiv.firstChild) frag.appendChild(tempDiv.firstChild);
        range.insertNode(frag);
        range.collapse(false);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        found = true;
        break;
      }
    }

    if (!found) {
      // Fallback: just insert at cursor
      editor.focus();
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        r.collapse(false);
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const frag = document.createDocumentFragment();
        while (tempDiv.firstChild) frag.appendChild(tempDiv.firstChild);
        r.insertNode(frag);
        r.collapse(false);
        sel.removeAllRanges();
        sel.addRange(r);
      }
    }

    saveSelection();
    onChange(editor.innerHTML);
  }, [restoreSelection, saveSelection, onChange]);

  const insertVerses = useCallback(async () => {
    if (!scripturePopup) return;
    const { ref } = scripturePopup;
    setInserting(true);
    try {
      const { bookName, verses } = await fetchVerses(ref.bookAbbrev, ref.chapter, ref.verse, ref.verseEnd);
      const html = formatVersesAsHtml(bookName, ref.chapter, verses);
      replaceReferenceAndInsert(ref.raw, html);
      setScripturePopup(null);
    } catch (err) {
      console.error('Error fetching verses:', err);
    } finally {
      setInserting(false);
    }
  }, [scripturePopup, replaceReferenceAndInsert]);

  // Search MSG documents
  const searchMsg = useCallback(async () => {
    if (!msgPopup) return;
    setMsgLoading(true);
    try {
      const matches = await searchMsgDocuments(msgPopup.ref);
      if (matches.length === 0) {
        setMsgMatches([]);
      } else if (matches.length === 1) {
        const html = formatMsgAsHtml(matches[0]);
        if (html) {
          replaceReferenceAndInsert(msgPopup.ref.raw, html);
          setMsgPopup(null);
          setMsgMatches(null);
        } else {
          setMsgMatches(matches);
        }
      } else {
        setMsgMatches(matches);
      }
    } catch (err) {
      console.error('Error searching MSG:', err);
      setMsgMatches([]);
    } finally {
      setMsgLoading(false);
    }
  }, [msgPopup, replaceReferenceAndInsert]);

  const insertMsgMatch = useCallback((match: MsgMatch) => {
    if (!msgPopup) return;
    const html = formatMsgAsHtml(match);
    if (html) {
      replaceReferenceAndInsert(msgPopup.ref.raw, html);
    }
    setMsgPopup(null);
    setMsgMatches(null);
  }, [replaceReferenceAndInsert, msgPopup]);

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
        onBlur={() => {
          saveSelection();
          setTimeout(() => {
            setScripturePopup(null);
            if (!msgMatches) setMsgPopup(null);
          }, 200);
        }}
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
          style={{ top: scripturePopup.top, left: scripturePopup.left }}
        >
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs shadow-md border border-border max-w-[320px]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={insertVerses}
            disabled={inserting}
          >
            {inserting ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <BookOpen className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">
              Inserir {scripturePopup.ref.bookName} {scripturePopup.ref.chapter}:{scripturePopup.ref.verse}
              {scripturePopup.ref.verseEnd ? `-${scripturePopup.ref.verseEnd}` : ''}
            </span>
          </Button>
        </div>
      )}

      {/* MSG insert popup */}
      {msgPopup && !msgMatches && (
        <div
          className="absolute z-50 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ top: msgPopup.top, left: msgPopup.left }}
        >
          <Button
            size="sm"
            variant="secondary"
            className="h-8 gap-1.5 text-xs shadow-md border border-border max-w-[320px]"
            onMouseDown={(e) => e.preventDefault()}
            onClick={searchMsg}
            disabled={msgLoading}
          >
            {msgLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
            <span className="truncate">Inserir {msgPopup.ref.docName} §{msgPopup.ref.paragraphs.join(', ')}</span>
          </Button>
        </div>
      )}

      {/* MSG multiple matches - choose document */}
      {msgPopup && msgMatches && msgMatches.length > 0 && (
        <div
          className="absolute z-50 animate-in fade-in-0 zoom-in-95 duration-150 bg-popover border border-border rounded-lg shadow-xl p-3 w-[420px] h-[320px] overflow-hidden flex flex-col"
          style={{
            top: Math.min(msgPopup.top + 42, containerRef.current?.clientHeight ? containerRef.current.clientHeight - 328 : msgPopup.top + 42),
            left: Math.min(msgPopup.left, containerRef.current?.clientWidth ? containerRef.current.clientWidth - 428 : msgPopup.left),
          }}
        >
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <p className="text-sm font-medium">
              {msgMatches.length} documento{msgMatches.length > 1 ? 's' : ''} encontrado{msgMatches.length > 1 ? 's' : ''}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setMsgPopup(null); setMsgMatches(null); }}
            >
              ✕
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto pr-1" onWheel={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              {msgMatches.map((m) => (
                <Button
                  key={m.id}
                  size="sm"
                  variant="ghost"
                  className="w-full justify-start h-auto py-2.5 px-3 text-left gap-2.5 hover:bg-accent/60"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMsgMatch(m)}
                >
                  <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col min-w-0 gap-0.5">
                    <span className="text-sm font-medium truncate">{m.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {[m.translator, m.date].filter(Boolean).join(' — ')}
                      {m.paragraphs.length > 0
                        ? ` • ${m.paragraphs.length} parágrafo${m.paragraphs.length > 1 ? 's' : ''}`
                        : ' • Parágrafos não encontrados'}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MSG no matches */}
      {msgPopup && msgMatches && msgMatches.length === 0 && (
        <div
          className="absolute z-50 animate-in fade-in-0 zoom-in-95 duration-150 bg-popover border border-border rounded-lg shadow-lg p-3"
          style={{
            top: Math.min(msgPopup.top + 42, containerRef.current?.clientHeight ? containerRef.current.clientHeight - 88 : msgPopup.top + 42),
            left: Math.min(msgPopup.left, containerRef.current?.clientWidth ? containerRef.current.clientWidth - 308 : msgPopup.left),
          }}
        >
          <p className="text-xs text-muted-foreground">Nenhum documento encontrado para "{msgPopup.ref.docName}"</p>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-xs mt-1"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setMsgPopup(null); setMsgMatches(null); }}
          >
            Fechar
          </Button>
        </div>
      )}
    </div>
  );
}
