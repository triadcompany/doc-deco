import { useRef, useCallback } from 'react';
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
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
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

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const savedRangeRef = useRef<Range | null>(null);

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

    // Browser compatibility: different engines accept different formatBlock values
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

  return (
    <div className="border border-input rounded-md overflow-hidden bg-background">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-1.5 border-b border-input bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('bold')}
          title="Negrito"
        >
          <Bold className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => exec('italic')}
          title="Itálico"
        >
          <Italic className="w-3.5 h-3.5" />
        </Button>

        <div className="w-px h-5 bg-border mx-1" />

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyBlock('h1')}
          title="Título 1"
        >
          <Heading1 className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyBlock('h2')}
          title="Título 2"
        >
          <Heading2 className="w-3.5 h-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs gap-1"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => applyBlock('p')}
          title="Corpo"
        >
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
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        onBlur={saveSelection}
        data-placeholder={placeholder}
        style={{ wordBreak: 'break-word' }}
      />
    </div>
  );
}
