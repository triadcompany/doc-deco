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
  RefreshCw,
} from 'lucide-react';
import { detectLastScriptureReference, ScriptureRef } from '@/lib/scripture-parser';
import { fetchVerses, formatVersesAsHtml } from '@/lib/bible-fetch';
import { detectMsgReference, searchMsgDocuments, formatMsgAsHtml, parseParagraphSpec, MsgRef, MsgMatch } from '@/lib/msg-reference';

// An already-inserted MSG citation's title reads "<document name> §<paragraphs>"
// (no "MSG:" prefix — that's only for typing a brand-new reference). Matching
// this lets editing that title offer to re-fetch instead of doing nothing.
const CITATION_TITLE_REGEX = /^(.+?)\s+§([\d\s,-]+)\s*$/;

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  fillHeight?: boolean;
}

// What studies look like today — Poppins at 14px, set as the app's global
// body font (src/index.css). Kept here so a fresh editor still looks the
// same even though size/family are now explicit, user-changeable styles
// instead of a fixed Tailwind class.
const DEFAULT_FONT_FAMILY = "'Poppins', sans-serif";
const DEFAULT_FONT_SIZE = '14';

const fontFamilies = [
  { label: 'Poppins (padrão)', value: DEFAULT_FONT_FAMILY },
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

  // MSG popup. mode:'update' means this is for re-fetching an already-inserted
  // citation (the user edited its title) rather than inserting a new one —
  // citationUpdateTargetRef holds the <blockquote> to replace in that case.
  const [msgPopup, setMsgPopup] = useState<{
    ref: MsgRef;
    top: number;
    left: number;
    mode?: 'update';
  } | null>(null);
  const [msgMatches, setMsgMatches] = useState<MsgMatch[] | null>(null);
  const [msgLoading, setMsgLoading] = useState(false);

  // Fonte/Tam. toolbar — reflect the study's current base font/size, which
  // starts at what studies look like today (Poppins, 14px).
  const [baseFontFamily, setBaseFontFamily] = useState(DEFAULT_FONT_FAMILY);
  const [baseFontSize, setBaseFontSize] = useState(DEFAULT_FONT_SIZE);
  const citationUpdateTargetRef = useRef<HTMLElement | null>(null);

  const closeMsgPopup = useCallback(() => {
    setMsgPopup(null);
    setMsgMatches(null);
    citationUpdateTargetRef.current = null;
  }, []);

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

  // Fonte/Tam. toolbar controls: wrap the target in a styled span directly
  // instead of document.execCommand('fontName'/'fontSize', ...) — that legacy
  // API silently does nothing once the Select popup has moved focus away from
  // the editor and back, which is why it never worked.
  //
  // With a selection, only that text is restyled (a one-off override). With
  // no selection — nothing highlighted, which is the common case: picking a
  // font/size as a default rather than to restyle a specific phrase — the
  // WHOLE study is wrapped in (or re-tagged with) a single base-style <div>,
  // so existing text visibly conforms to the choice and it's saved as part of
  // the content, not just a transient style on the editor element itself.
  const applyInlineStyle = useCallback((styleProp: 'fontFamily' | 'fontSize', styleValue: string) => {
    editorRef.current?.focus();
    restoreSelection();
    const sel = window.getSelection();
    const editor = editorRef.current;
    if (!sel || !editor) return;

    if (sel.isCollapsed) {
      const children = Array.from(editor.childNodes);
      const existingWrapper =
        children.length === 1 && children[0] instanceof HTMLElement && children[0].dataset.baseStyleWrapper === 'true'
          ? (children[0] as HTMLElement)
          : null;
      const wrapper = existingWrapper || document.createElement('div');
      wrapper.dataset.baseStyleWrapper = 'true';
      wrapper.style[styleProp] = styleValue;
      if (!existingWrapper) {
        const hasContent = !!editor.textContent?.trim();
        if (hasContent) {
          while (editor.firstChild) wrapper.appendChild(editor.firstChild);
        } else {
          wrapper.innerHTML = '<br/>';
        }
        editor.innerHTML = '';
        editor.appendChild(wrapper);
      }
      // Keep typing inside the wrapper so new text inherits the base style too.
      const r = document.createRange();
      r.selectNodeContents(wrapper);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
      saveSelection();
      onChange(editor.innerHTML);
      return;
    }

    const range = sel.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) return;

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
    onChange(editor.innerHTML);
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
      // Baseline so studies keep looking the same as before size/family
      // became explicit styles instead of a fixed Tailwind class — any
      // inline style already inside `value` (a chosen base font, or a
      // one-off span override) still wins, since it's more specific.
      el.style.fontFamily = DEFAULT_FONT_FAMILY;
      el.style.fontSize = `${DEFAULT_FONT_SIZE}px`;
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

    // Measuring a COLLAPSED range's rect is unreliable \u2014 WebKit (notably
    // iPadOS/iOS Safari) frequently reports it as all-zero (top/left/width/
    // height all 0) instead of just width 0, which sent the popup flying to
    // the very top of the screen instead of next to the cursor. Measuring
    // the character right before the cursor \u2014 a real, non-collapsed text
    // range \u2014 is geometry every engine gets right, so prefer that.
    let rect: DOMRect | null = null;
    const startNode = caretRange.startContainer;
    const startOffset = caretRange.startOffset;
    if (startNode.nodeType === Node.TEXT_NODE && startOffset > 0) {
      const charRange = document.createRange();
      charRange.setStart(startNode, startOffset - 1);
      charRange.setEnd(startNode, startOffset);
      const charRect = charRange.getBoundingClientRect();
      if (charRect.width > 0 || charRect.height > 0) {
        rect = new DOMRect(charRect.right, charRect.top, 0, charRect.height);
      }
    }

    if (!rect) {
      rect = caretRange.getBoundingClientRect();
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
      closeMsgPopup();
      return;
    }

    // If the cursor sits inside the title of an already-inserted MSG citation
    // (format "<document> §<paragraphs>", no "MSG:" prefix), offer to re-fetch
    // it instead of trying to detect a brand-new reference. This is what lets
    // editing "...§50" into "...§55" on an existing citation actually change
    // which paragraph is shown — plain text editing alone never did.
    if (sel && sel.rangeCount > 0 && editorRef.current) {
      const node = sel.getRangeAt(0).startContainer;
      const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
      const h2 = el?.closest('h2') ?? null;
      const blockquote = h2?.closest('blockquote') ?? null;
      if (h2 && blockquote && editorRef.current.contains(blockquote)) {
        const titleMatch = (h2.textContent || '').trim().match(CITATION_TITLE_REGEX);
        const paragraphs = titleMatch ? parseParagraphSpec(titleMatch[2]) : [];
        if (titleMatch && paragraphs.length > 0) {
          const cursorInfo = getTextNearCursor();
          if (cursorInfo) {
            const { rect } = cursorInfo;
            const popupWidth = 320;
            const popupHeight = 36;
            const gutter = 8;
            const left = Math.max(gutter, Math.min(rect.left + 12, window.innerWidth - popupWidth - gutter));
            const top = Math.max(
              gutter,
              rect.top > popupHeight + gutter
                ? rect.top - popupHeight - 6
                : Math.min(rect.bottom + 6, window.innerHeight - popupHeight - gutter)
            );
            // Recover translator/date from the meta line next to the title
            // (e.g. "GO — 1963-03-17") for a more precise match — several
            // documents can share a very similar title.
            let translator: string | undefined;
            let date: string | undefined;
            const metaEl = h2.nextElementSibling;
            if (metaEl?.tagName === 'SPAN') {
              const datePattern = /^\d{2,4}[-/]\d{2}[-/]\d{2,4}$/;
              for (const part of (metaEl.textContent || '').split('—').map((s) => s.trim()).filter(Boolean)) {
                if (datePattern.test(part)) date = part; else translator = part;
              }
            }

            citationUpdateTargetRef.current = blockquote as HTMLElement;
            setScripturePopup(null);
            setMsgMatches(null);
            setMsgPopup({
              ref: { docName: titleMatch[1].trim(), paragraphs, translator, date, raw: h2.textContent || '' },
              top,
              left,
              mode: 'update',
            });
            return;
          }
        }
      }
    }
    citationUpdateTargetRef.current = null;

    const cursorInfo = getTextNearCursor();
    if (!cursorInfo) {
      setScripturePopup(null);
      closeMsgPopup();
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

    const top = Math.max(
      gutter,
      rect.top > popupHeight + gutter
        ? rect.top - popupHeight - 6
        : Math.min(rect.bottom + 6, window.innerHeight - popupHeight - gutter)
    );

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
      closeMsgPopup();
      setScripturePopup({ ref, top, left });
    } else {
      setScripturePopup(null);
      closeMsgPopup();
    }
  }, [getTextNearCursor, closeMsgPopup]);

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
          const top = Math.max(
            gutter,
            rect.top > popupHeight + gutter ? rect.top - popupHeight - 6 : rect.bottom + 6
          );

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

  // Replace an already-inserted citation's <blockquote> with a freshly
  // fetched one — used when the user edited its title to a different
  // paragraph range and confirmed the "Atualizar" popup.
  const applyCitationUpdate = useCallback((match: MsgMatch) => {
    const target = citationUpdateTargetRef.current;
    citationUpdateTargetRef.current = null;
    if (!target || !target.parentNode) return;

    const html = formatMsgAsHtml(match);
    if (!html) return;

    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newNode = temp.firstElementChild;
    if (!newNode) return;

    target.replaceWith(newNode);

    const sel = window.getSelection();
    if (sel) {
      const r = document.createRange();
      r.selectNodeContents(newNode);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }

    saveSelection();
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange, saveSelection]);

  // Search MSG documents
  const searchMsg = useCallback(async () => {
    if (!msgPopup) return;
    setMsgLoading(true);
    try {
      const matches = await searchMsgDocuments(msgPopup.ref);
      if (matches.length === 0) {
        setMsgMatches([]);
      } else if (matches.length === 1) {
        if (msgPopup.mode === 'update') {
          applyCitationUpdate(matches[0]);
          setMsgPopup(null);
          setMsgMatches(null);
        } else {
          const html = formatMsgAsHtml(matches[0]);
          if (html) {
            replaceReferenceAndInsert(msgPopup.ref.raw, `${html}<p><br/></p>`);
            setMsgPopup(null);
            setMsgMatches(null);
          } else {
            setMsgMatches(matches);
          }
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
  }, [msgPopup, replaceReferenceAndInsert, applyCitationUpdate]);

  const insertMsgMatch = useCallback((match: MsgMatch) => {
    if (!msgPopup) return;
    if (msgPopup.mode === 'update') {
      applyCitationUpdate(match);
    } else {
      const html = formatMsgAsHtml(match);
      if (html) {
        replaceReferenceAndInsert(msgPopup.ref.raw, `${html}<p><br/></p>`);
      }
    }
    setMsgPopup(null);
    setMsgMatches(null);
  }, [replaceReferenceAndInsert, msgPopup, applyCitationUpdate]);

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

        <Select
          value={baseFontFamily}
          onValueChange={(v) => { setBaseFontFamily(v); applyInlineStyle('fontFamily', v); }}
        >
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

        <Select
          value={baseFontSize}
          onValueChange={(v) => { setBaseFontSize(v); applyInlineStyle('fontSize', `${v}px`); }}
        >
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
            if (!msgMatches) { setMsgPopup(null); citationUpdateTargetRef.current = null; }
          }, 200);
        }}
        data-placeholder={placeholder}
        className={cn(
          // No base text-size/font-family class here on purpose — those are
          // explicit inline styles now (handleRef sets the default, Fonte/
          // Tam. in the toolbar change it), so a fixed Tailwind size class on
          // <p> would always win over them by specificity and the toolbar
          // would visibly do nothing. Headings keep their own fixed sizing.
          "overflow-y-auto p-3 sm:p-3 focus:outline-none [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground/50 max-w-none [&_h1]:text-xl [&_h1]:sm:text-2xl [&_h1]:font-bold [&_h1]:leading-tight [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:sm:text-xl [&_h2]:font-semibold [&_h2]:leading-snug [&_h2]:mb-2 [&_p]:font-normal [&_p]:leading-relaxed",
          fillHeight ? "min-h-[150px] sm:min-h-[200px] flex-1" : "min-h-[200px] sm:min-h-[300px] max-h-[40vh] sm:max-h-[50vh]"
        )}
        style={{ wordBreak: 'break-word', WebkitUserSelect: 'text', userSelect: 'text' }}
      />

      {/* All floating popups below are portalled straight to <body>, positioned
          in viewport coordinates but rendered with `absolute` (+ window.scrollX/Y)
          instead of `fixed`. Two reasons: this container has overflow-hidden
          (needed to clip the editor's own scroll area), which was silently
          cutting these off whenever they didn't fit inside it (short editor,
          split view, mobile) — portalling escapes that. And iPadOS/iOS Safari
          has long-standing bugs placing `position: fixed` elements incorrectly
          (often pinned near the top of the page) once any ancestor scrolls or
          the page has a scrollable region — `absolute` relative to <body> with
          the scroll offset added back in sidesteps that engine-specific quirk. */}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Text Selection Popup */}
          {selectionPopup && (
            <div
              className="absolute z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150 flex items-center gap-1 p-1 bg-background border border-border rounded-md shadow-md"
              style={{ top: selectionPopup.top + window.scrollY, left: selectionPopup.left + window.scrollX }}
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
              className="absolute z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150"
              style={{ top: scripturePopup.top + window.scrollY, left: scripturePopup.left + window.scrollX }}
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
              className="absolute z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150"
              style={{ top: msgPopup.top + window.scrollY, left: msgPopup.left + window.scrollX }}
            >
              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5 text-xs shadow-md border border-border max-w-[320px]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={searchMsg}
                disabled={msgLoading}
              >
                {msgLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                ) : msgPopup.mode === 'update' ? (
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <FileText className="w-3.5 h-3.5 shrink-0" />
                )}
                <span className="truncate">
                  {msgPopup.mode === 'update' ? 'Atualizar' : 'Inserir'} {msgPopup.ref.docName} §{msgPopup.ref.paragraphs.join(', ')}
                </span>
              </Button>
            </div>
          )}

          {/* MSG multiple matches - choose document */}
          {msgPopup && msgMatches && msgMatches.length > 0 && (
            <div
              className="absolute z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150 bg-popover border border-border rounded-lg shadow-xl p-3 w-[min(420px,calc(100vw-16px))] max-h-[min(320px,60vh)] overflow-hidden flex flex-col"
              style={{
                // Conservative estimate (max popup height) so it flips above the
                // cursor instead of running off the bottom of the screen.
                top: Math.max(8, Math.min(msgPopup.top + 42, window.innerHeight - 328)) + window.scrollY,
                left: Math.max(8, Math.min(msgPopup.left, window.innerWidth - Math.min(420, window.innerWidth - 16) - 8)) + window.scrollX,
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
                  onClick={closeMsgPopup}
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
              className="absolute z-[60] pointer-events-auto animate-in fade-in-0 zoom-in-95 duration-150 bg-popover border border-border rounded-lg shadow-lg p-3 w-[min(300px,calc(100vw-16px))]"
              style={{
                top: Math.max(8, Math.min(msgPopup.top + 42, window.innerHeight - 88)) + window.scrollY,
                left: Math.max(8, Math.min(msgPopup.left, window.innerWidth - 300 - 8)) + window.scrollX,
              }}
            >
              <p className="text-xs text-muted-foreground">Nenhum documento encontrado para "{msgPopup.ref.docName}"</p>
              <Button
                size="sm"
                variant="ghost"
                className="w-full text-xs mt-1"
                onMouseDown={(e) => e.preventDefault()}
                onClick={closeMsgPopup}
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
