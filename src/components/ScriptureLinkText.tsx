import { parseScriptureReferences, TextSegment } from '@/lib/scripture-parser';
import { Button } from '@/components/ui/button';

interface ScriptureLinkTextProps {
  text: string;
  onNavigate: (bookAbbrev: string, chapter: number, verse: number) => void;
}

export function ScriptureLinkText({ text, onNavigate }: ScriptureLinkTextProps) {
  const segments = parseScriptureReferences(text);

  return (
    <span>
      {segments.map((seg, i) =>
        seg.type === 'reference' && seg.ref ? (
          <Button
            key={i}
            variant="link"
            className="h-auto p-0 text-primary underline decoration-dotted underline-offset-2 font-medium"
            onClick={() => onNavigate(seg.ref!.bookAbbrev, seg.ref!.chapter, seg.ref!.verse)}
            title={`Ir para ${seg.ref.bookName} ${seg.ref.chapter}:${seg.ref.verse}`}
          >
            {seg.content}
          </Button>
        ) : (
          <span key={i}>{seg.content}</span>
        )
      )}
    </span>
  );
}
