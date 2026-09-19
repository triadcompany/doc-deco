import { useRef, useCallback, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  RemoveFormatting,
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

// Values are plain pixel sizes (used to build "<n>px" for the inline style
// wrapper) — document.execCommand('fontSize', ...) took legacy 1-7 levels
// instead and never reliably applied, which is why this control didn't work.
const fontSizes = [
  { label: '12', value: '12' },
  { label: '14', value: '14' },
  { label: '16', value: '16' },
  { label: '18', value: '18' },
  { label: '24', value: '24' },
  { label: '32', value: '32' },
  { label: '48', value: '48' },
];

export function RichTextEditor({ value, onChange, placeholder, fillHeight = false }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Selection popup
  const [selectionPopup, setSelectionPopup] = useState<{
    top: number;
    left: number;
  } | null>(null);

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

  // Fonte/Tam. toolbar controls: wrap the current selection in a styled span
  // directly instead of document.execCommand('fontName'/'fontSize', ...) —
  // that legacy API silently does nothing once the Select popup has moved
  // focus away from the editor and back, which is why it never worked.
  const applyInlineStyle = useCallback((styleProp: 'fontFamily' | 'fontSize', styleValue: string) => {
    editorRef.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    if (!editorRef.current || !editorRef.current.contains(range.commonAncestorContainer)) return;

    const span = document.createElement('span');
    span.style[styleProp] = styleValue;
    try {
      range.surroundContents(span);
    } catch {
      // Selection crosses element boundaries (e.g. spans two paragraphs) —
      // surroundContents can't wrap that in one node, so extract + wrap instead.
      const frag = range.extractContents();
      span.appendChild(frag);
      range.insertNode(span);
    }

    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(span);
    sel.addRange(newRange);

    saveSelection();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
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

  // Sync external value changes (e.g. when loading an existing study async)
  // without disrupting the user while typing.
  useEffect(() => {
    if (!editorRef.current) return;
    if (!isInitialized.current) return;
    const current = editorRef.current.innerHTML;
    if (current === value) return;
    // Only overwrite if the editor isn't currently focused (avoid clobbering typing)
    if (document.activeElement === editorRef.current) return;
    editorRef.current.innerHTML = value || '';
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

  const removeBlockquote = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    restoreSelection();
    // Find the blockquote ancestor of the current selection
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      let node: Node | null = sel.getRangeAt(0).commonAncestorContainer;
      while (node && node !== editorRef.current) {
        if (node.nodeName === 'BLOCKQUOTE') {
          // Replace blockquote with its children
          const parent = node.parentNode;
          if (parent) {
            const frag = document.createDocumentFragment();
            while (node.firstChild) frag.appendChild(node.firstChild);
            // Add a normal paragraph after
            const p = document.createElement('p');
            p.innerHTML = '<br/>';
            frag.appendChild(p);
            parent.replaceChild(frag, node);
            // Move cursor to the new paragraph
            const newSel = window.getSelection();
            if (newSel) {
              const r = document.createRange();
              r.setStart(p, 0);
              r.collapse(true);
              newSel.removeAllRanges();
              newSel.addRange(r);
            }
          }
          break;
        }
        node = node.parentNode;
      }
    }
    saveSelection();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
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
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) {
      setScripturePopup(null);
      setMsgPopup(null);
      setMsgMatches(null);
      return;
    }

    const cursorInfo = getTextNearCursor();
    if (!cursorInfo) {
      setScripturePopup(null);
      setMsgPopup(null);
      setMsgMatches(null);
      return;
    }

    // Popups are portalled to <body> and positioned with `fixed`, so these are
    // plain viewport coordinates (not relative to the editor's own container —
    // that container has overflow-hidden, which was clipping the popups).
    const { text, rect } = cursorInfo;
    const popupWidth = 320;
    const popupHeight = 36;
    const gutter = 8;

    const left = Math.max(
      gutter,
      Math.min(rect.left + 12, window.innerWidth - popupWidth - gutter)
    );

    const top = rect.top > popupHeight + gutter
      ? rect.top - popupHeight - 6
      : Math.min(rect.bottom + 6, window.innerHeight - popupHeight - gutter);

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

  const checkSelection = useCallback(() => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          const popupWidth = 144;
          const popupHeight = 36;
          const gutter = 8;

          const idealLeft = rect.left + (rect.width / 2) - (popupWidth / 2);

          const left = Math.max(gutter, Math.min(idealLeft, window.innerWidth - popupWidth - gutter));
          const top = rect.top > popupHeight + gutter
            ? rect.top - popupHeight - 6
            : rect.bottom + 6;

          setSelectionPopup({ top, left });
          return;
        }
      }
      setSelectionPopup(null);
    }, 10);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const handleKeyUp = useCallback((_e: React.KeyboardEvent) => {
    saveSelection();
    debouncedDetect();
    checkSelection();
  }, [saveSelection, debouncedDetect, checkSelection]);

  // Replace the reference text in the editor with the given HTML
  const replaceReferenceAndInsert = useCallback((referenceText: string, html: string) => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const refNorm = referenceText.trim();

    const insertFragmentAt = (range: Range) => {
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
    };

    let found = false;

    // Prefer the exact spot where the reference was just typed (saved on the
    // last keyup) over a blind document-wide search. Otherwise, typing the same
    // reference a second time further down matches the FIRST occurrence again —
    // which, after the first insert, is the title text inside that blockquote —
    // silently replacing it instead of the new spot the user is looking at.
    const savedRange = savedRangeRef.current;
    if (savedRange && editor.contains(savedRange.startContainer) && savedRange.startContainer.nodeType === Node.TEXT_NODE) {
      const node = savedRange.startContainer as Text;
      const textBefore = (node.textContent || '').slice(0, savedRange.startOffset);
      const idx = textBefore.lastIndexOf(refNorm);
      const insideBlockquote = !!node.parentElement?.closest('blockquote');
      if (idx !== -1 && idx + refNorm.length === textBefore.length && !insideBlockquote) {
        const range = document.createRange();
        // Never treat the contentEditable root itself as "the block to replace" —
        // when the typed reference is the very first/only content, the text node's
        // nearest p/div/li ancestor IS the editor root, and selectNode()+deleteContents()
        // on it deletes the editor's own DOM node, silently ending all editing.
        const rawBlock = node.parentElement?.closest('p, div, li') || node.parentElement;
        const parentBlock = rawBlock && rawBlock !== editor ? rawBlock : null;
        const blockText = parentBlock?.textContent?.trim() || '';
        if (parentBlock && blockText === refNorm) {
          range.selectNode(parentBlock);
        } else {
          range.setStart(node, idx);
          range.setEnd(node, idx + refNorm.length);
        }
        range.deleteContents();
        insertFragmentAt(range);
        found = true;
      }
    }

    if (!found) {
      // Fallback: document-wide search. Also handles re-inserting after editing
      // the title text inside an existing blockquote (the saved-range match
      // above deliberately skips that case via `insideBlockquote`).
      const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        const idx = node.textContent?.indexOf(refNorm) ?? -1;
        if (idx !== -1) {
          const range = document.createRange();

          // If the reference text lives inside an already-rendered scripture/msg
          // blockquote, replace the entire blockquote — not just the inner text.
          const existingBlockquote = node.parentElement?.closest('blockquote');
          if (existingBlockquote) {
            range.selectNode(existingBlockquote);
          } else {
            // Same guard as above: never let the editor root itself be "the block".
            const rawBlock = node.parentElement?.closest('p, div, li') || node.parentElement;
            const parentBlock = rawBlock && rawBlock !== editor ? rawBlock : null;
            const blockText = parentBlock?.textContent?.trim() || '';
            if (parentBlock && (blockText === refNorm || blockText === refNorm + '\n' || blockText === '\n' + refNorm)) {
              range.selectNode(parentBlock);
            } else {
              range.setStart(node, idx);
              range.setEnd(node, idx + refNorm.length);
            }
          }

          range.deleteContents();
          insertFragmentAt(range);
          found = true;
          break;
        }
      }
    }

    if (!found) {
      // Last resort: just insert at cursor
      editor.focus();
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const r = sel.getRangeAt(0);
        r.collapse(false);
        insertFragmentAt(r);
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
      const { bookName, verses } = await fetchVerses(ref.bookAbbrev, ref.chapter, ref.verse, undefined, undefined, ref.verseNumbers);
      const html = formatVersesAsHtml(bookName, ref.chapter, verses, ref.verseLabel);
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
      {/* Toolbar — sticky on mobile so it stays reachable while scrolling */}
      <div className="sticky top-0 z-20 flex items-center gap-0.5 p-1 sm:p-1.5 border-b border-input bg-muted/95 backdrop-blur sm:bg-muted/30 overflow-x-auto scrollbar-none">
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 touch-target sm:touch-auto"
          onMouseDown={(e) => e.preventDefault()} onClick={() => exec('bold')} title="Negrito">
          <Bold className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 touch-target sm:touch-auto"
          onMouseDown={(e) => e.preventDefault()} onClick={() => exec('italic')} title="Itálico">
          <Italic className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </Button>

        <div className="w-px h-6 sm:h-5 bg-border mx-1 shrink-0" />

        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 touch-target sm:touch-auto"
          onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('h1')} title="Título 1">
          <Heading1 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 touch-target sm:touch-auto"
          onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('h2')} title="Título 2">
          <Heading2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 touch-target sm:touch-auto"
          onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlock('p')} title="Corpo">
          <Type className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 sm:h-7 sm:w-7 shrink-0 touch-target sm:touch-auto"
          onMouseDown={(e) => e.preventDefault()} onClick={removeBlockquote} title="Sair da citação">
          <RemoveFormatting className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
        </Button>

        <div className="w-px h-6 sm:h-5 bg-border mx-1 shrink-0" />

        <Select onValueChange={(v) => applyInlineStyle('fontFamily', v)}>
          <SelectTrigger className="h-9 sm:h-7 w-[100px] sm:w-[110px] text-xs shrink-0">
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

        <Select onValueChange={(v) => applyInlineStyle('fontSize', `${v}px`)}>
          <SelectTrigger className="h-9 sm:h-7 w-[68px] sm:w-[70px] text-xs shrink-0">
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
        onMouseUp={() => { saveSelection(); debouncedDetect(); checkSelection(); }}
        onTouchEnd={() => { saveSelection(); debouncedDetect(); checkSelection(); }}
        onKeyUp={handleKeyUp}
        onBlur={() => {
          saveSelection();
          setTimeout(() => {
            setScripturePopup(null);
            setSelectionPopup(null);
            if (!msgMatches) setMsgPopup(null);
          }, 200);
        }}
        data-placeholder={placeholder}
        className={cn(
          "overflow-y-auto p-3 sm:p-3 text-sm sm:text-sm focus:outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground/50 max-w-none [&_h1]:text-xl [&_h1]:sm:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:mb-2 [&_p]:text-sm [&_p]:font-normal [&_p]:leading-relaxed",
          fillHeight ? "min-h-[150px] sm:min-h-[200px] flex-1" : "min-h-[200px] sm:min-h-[300px] max-h-[40vh] sm:max-h-[50vh]"
        )}
        style={{ wordBreak: 'break-word', WebkitUserSelect: 'text', userSelect: 'text' }}
      />

      {/* All floating popups below are portalled straight to <body> and use
          `fixed` + viewport coordinates — this container has overflow-hidden
          (needed to clip the editor's own scroll area), which was silently
          cutting these off whenever they didn't fit inside it (short editor,
          split view, mobile). Portalling escapes that entirely. */}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Text Selection Popup */}
          {selectionPopup && (
            <div
              className="fixed z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150 flex items-center gap-1 p-1 bg-background border border-border rounded-md shadow-md"
              style={{ top: selectionPopup.top, left: selectionPopup.left }}
            >
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { exec('bold'); checkSelection(); }} title="Negrito">
                <Bold className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { exec('italic'); checkSelection(); }} title="Itálico">
                <Italic className="w-3.5 h-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { applyBlock('h1'); checkSelection(); }} title="Título 1">
                <Heading1 className="w-3.5 h-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                onMouseDown={(e) => e.preventDefault()} onClick={() => { applyBlock('h2'); checkSelection(); }} title="Título 2">
                <Heading2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Scripture insert popup */}
          {scripturePopup && (
            <div
              className="fixed z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150"
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
                  Inserir {scripturePopup.ref.bookName} {scripturePopup.ref.chapter}:{scripturePopup.ref.verseLabel}
                </span>
              </Button>
            </div>
          )}

          {/* MSG insert popup */}
          {msgPopup && !msgMatches && (
            <div
              className="fixed z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150"
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
              className="fixed z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150 bg-popover border border-border rounded-lg shadow-xl p-3 w-[min(420px,calc(100vw-16px))] max-h-[min(320px,60vh)] overflow-hidden flex flex-col"
              style={{
                // Conservative estimate (max popup height) so it flips above the
                // cursor instead of running off the bottom of the screen.
                top: Math.max(8, Math.min(msgPopup.top + 42, window.innerHeight - 328)),
                left: Math.max(8, Math.min(msgPopup.left, window.innerWidth - Math.min(420, window.innerWidth - 16) - 8)),
              }}
            >
              <div className="flex items-center justify-between mb-2 px-1 shrink-0">
                <p className="text-sm font-medium">
                  {msgMatches.length} documento{msgMatches.length > 1 ? 's' : ''} encontrado{msgMatches.length > 1 ? 's' : ''}
                </p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setMsgPopup(null); setMsgMatches(null); }}
                >
                  ✕
                </Button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto pr-1 overscroll-contain" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
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
              className="fixed z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150 bg-popover border border-border rounded-lg shadow-lg p-3 w-[min(300px,calc(100vw-16px))]"
              style={{
                top: Math.max(8, Math.min(msgPopup.top + 42, window.innerHeight - 88)),
                left: Math.max(8, Math.min(msgPopup.left, window.innerWidth - 300 - 8)),
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
        </>,
        document.body
      )}
    </div>
  );
}
