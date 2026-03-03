import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DEFAULT_COLOR, NODE_COLORS } from './types';
import type { MindMapNode, MindMapEdge } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (nodes: MindMapNode[], edges: MindMapEdge[]) => void;
}

export function TopicImportDialog({ open, onClose, onImport }: Props) {
  const [text, setText] = useState('');

  const handleImport = () => {
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length === 0) return;

    const nodes: MindMapNode[] = [];
    const edges: MindMapEdge[] = [];
    const stack: { id: string; level: number }[] = [];
    let counter = 1;

    for (const line of lines) {
      const stripped = line.replace(/\t/g, '  ');
      const indent = stripped.search(/\S/);
      const level = Math.floor(indent / 2);
      const label = stripped.trim().replace(/^[-•*]\s*/, '');
      const id = `n${counter++}`;

      const colorIndex = Math.min(level, NODE_COLORS.length - 1);
      nodes.push({
        id,
        type: 'mindMapNode',
        position: { x: 0, y: 0 },
        data: { label, color: NODE_COLORS[colorIndex] || DEFAULT_COLOR },
      });

      // Find parent
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      if (stack.length > 0) {
        const parentId = stack[stack.length - 1].id;
        edges.push({ id: `e${parentId}-${id}`, source: parentId, target: id, type: 'smoothstep' });
      }
      stack.push({ id, level });
    }

    onImport(nodes, edges);
    setText('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar de Tópicos</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Digite os tópicos usando indentação (2 espaços) para definir a hierarquia:
          </p>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Tema principal\n  Subtema 1\n    Detalhe A\n    Detalhe B\n  Subtema 2`}
            rows={12}
            className="font-mono text-sm"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleImport} disabled={!text.trim()}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
