import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  BackgroundVariant,
  MiniMap,
  type Connection,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LayoutGrid, FileDown, FileUp, Plus, Undo2, ZoomIn, Keyboard } from 'lucide-react';
import { MindMapCustomNode } from './MindMapCustomNode';
import { TopicImportDialog } from './TopicImportDialog';
import { autoLayout } from './layout';
import {
  DEFAULT_COLOR,
  NODE_COLORS,
  serialiseFromFlow,
  serialiseToNodes,
  parseMindMap,
  type MindMapNode,
  type MindMapEdge,
  type MindMapNodeData,
} from './types';

const nodeTypes = { mindMapNode: MindMapCustomNode as any };

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  style: { strokeWidth: 2 },
};

interface Props {
  initialValue?: string;
  onChange?: (json: string) => void;
  fillHeight?: boolean;
  compact?: boolean;
}

let idCounter = 1;
function nextId() {
  return `mm_${Date.now()}_${idCounter++}`;
}

function MindMapEditorInner({ initialValue, onChange, fillHeight = false, compact = false }: Props) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, zoomIn } = useReactFlow();
  const [importOpen, setImportOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const initial = useMemo(() => {
    const parsed = initialValue ? parseMindMap(initialValue) : null;
    if (parsed) return serialiseToNodes(parsed);
    const rootId = nextId();
    return {
      nodes: [
        {
          id: rootId,
          type: 'mindMapNode',
          position: { x: 0, y: 0 },
          data: { label: 'Tema principal', color: DEFAULT_COLOR },
        },
      ] as MindMapNode[],
      edges: [] as MindMapEdge[],
    };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);

  // Emit changes
  useEffect(() => {
    onChange?.(serialiseFromFlow(nodes as MindMapNode[], edges));
  }, [nodes, edges, onChange]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));
    },
    [setEdges],
  );

  // Custom event handlers
  useEffect(() => {
    const handleAddChild = (e: Event) => {
      const { parentId } = (e as CustomEvent).detail;
      const childId = nextId();
      setNodes((nds) => {
        const parent = nds.find((n) => n.id === parentId);
        const parentPos = parent?.position || { x: 0, y: 0 };
        const parentColor = (parent?.data as MindMapNodeData)?.color || DEFAULT_COLOR;
        const siblingCount = edges.filter((ed) => ed.source === parentId).length;
        // Assign child a color from palette based on sibling index
        const colorIndex = (NODE_COLORS.indexOf(parentColor) + 1 + siblingCount) % NODE_COLORS.length;
        return [
          ...nds.map((n) => ({ ...n, selected: false })),
          {
            id: childId,
            type: 'mindMapNode',
            position: { x: parentPos.x + 300, y: parentPos.y + siblingCount * 72 },
            data: { label: '', color: NODE_COLORS[colorIndex] },
            selected: true,
          },
        ];
      });
      setEdges((eds) => [...eds, { id: `e${parentId}-${childId}`, source: parentId, target: childId, ...defaultEdgeOptions }]);
      // Trigger edit mode on new node
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mindmap:start-edit', { detail: { id: childId } }));
      }, 100);
    };

    const handleDeleteNode = (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      // Also delete all descendant nodes
      const toDelete = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const edge of edges) {
          if (toDelete.has(edge.source) && !toDelete.has(edge.target)) {
            toDelete.add(edge.target);
            changed = true;
          }
        }
      }
      setNodes((nds) => nds.filter((n) => !toDelete.has(n.id)));
      setEdges((eds) => eds.filter((edge) => !toDelete.has(edge.source) && !toDelete.has(edge.target)));
    };

    const handleUpdateNode = (e: Event) => {
      const { id, ...updates } = (e as CustomEvent).detail;
      setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...updates } } : n)),
      );
    };

    window.addEventListener('mindmap:add-child', handleAddChild);
    window.addEventListener('mindmap:delete-node', handleDeleteNode);
    window.addEventListener('mindmap:update-node', handleUpdateNode);
    return () => {
      window.removeEventListener('mindmap:add-child', handleAddChild);
      window.removeEventListener('mindmap:delete-node', handleDeleteNode);
      window.removeEventListener('mindmap:update-node', handleUpdateNode);
    };
  }, [setNodes, setEdges, edges]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const selected = nodes.find((n) => n.selected);

      // Tab → add child
      if (e.key === 'Tab' && selected) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('mindmap:add-child', { detail: { parentId: selected.id } }));
        return;
      }

      // Enter → add sibling (child of same parent)
      if (e.key === 'Enter' && selected) {
        e.preventDefault();
        const parentEdge = edges.find((ed) => ed.target === selected.id);
        if (parentEdge) {
          window.dispatchEvent(new CustomEvent('mindmap:add-child', { detail: { parentId: parentEdge.source } }));
        } else {
          // Root node: add a new root below
          const id = nextId();
          setNodes((nds) => [
            ...nds.map((n) => ({ ...n, selected: false })),
            {
              id,
              type: 'mindMapNode',
              position: { x: selected.position.x, y: selected.position.y + 90 },
              data: { label: '', color: DEFAULT_COLOR },
              selected: true,
            },
          ]);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('mindmap:start-edit', { detail: { id } }));
          }, 100);
        }
        return;
      }

      // Delete/Backspace → delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('mindmap:delete-node', { detail: { id: selected.id } }));
        return;
      }

      // Arrow keys → navigate between nodes
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        if (!selected) {
          if (nodes.length > 0) {
            setNodes((nds) => nds.map((n, i) => ({ ...n, selected: i === 0 })));
          }
          return;
        }

        if (e.key === 'ArrowRight') {
          const childEdge = edges.find((ed) => ed.source === selected.id);
          if (childEdge) {
            setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === childEdge.target })));
          }
        } else if (e.key === 'ArrowLeft') {
          const parentEdge = edges.find((ed) => ed.target === selected.id);
          if (parentEdge) {
            setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === parentEdge.source })));
          }
        } else {
          const parentEdge = edges.find((ed) => ed.target === selected.id);
          let siblings: string[];
          if (parentEdge) {
            siblings = edges.filter((ed) => ed.source === parentEdge.source).map((ed) => ed.target);
          } else {
            const targets = new Set(edges.map((ed) => ed.target));
            siblings = nodes.filter((n) => !targets.has(n.id)).map((n) => n.id);
          }
          const siblingNodes = siblings
            .map((sid) => nodes.find((n) => n.id === sid)!)
            .filter(Boolean)
            .sort((a, b) => a.position.y - b.position.y);
          const currentIdx = siblingNodes.findIndex((n) => n.id === selected.id);
          const nextIdx = e.key === 'ArrowDown'
            ? Math.min(currentIdx + 1, siblingNodes.length - 1)
            : Math.max(currentIdx - 1, 0);
          if (nextIdx !== currentIdx) {
            setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === siblingNodes[nextIdx].id })));
          }
        }
        return;
      }

      // L → auto layout
      if (e.key === 'l' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleAutoLayout();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes]);

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => {
      const laid = autoLayout(nds as MindMapNode[], edges);
      setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 50);
      return laid;
    });
  }, [edges, setNodes, fitView]);

  const handleExportImage = useCallback(async () => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow__viewport') as HTMLElement;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: '#0f172a',
        quality: 1,
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = 'mapa-mental.png';
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Export failed:', err);
    }
  }, []);

  const handleImport = useCallback(
    (importedNodes: MindMapNode[], importedEdges: MindMapEdge[]) => {
      const laid = autoLayout(importedNodes, importedEdges);
      setNodes(laid);
      setEdges(importedEdges);
      setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 100);
    },
    [setNodes, setEdges, fitView],
  );

  const handleAddNode = useCallback(() => {
    const selected = nodes.find((n) => n.selected);
    if (selected) {
      window.dispatchEvent(new CustomEvent('mindmap:add-child', { detail: { parentId: selected.id } }));
    } else {
      const id = nextId();
      setNodes((nds) => [
        ...nds.map((n) => ({ ...n, selected: false })),
        {
          id,
          type: 'mindMapNode',
          position: { x: 0, y: (nds.length + 1) * 90 },
          data: { label: '', color: DEFAULT_COLOR },
          selected: true,
        },
      ]);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mindmap:start-edit', { detail: { id } }));
      }, 100);
    }
  }, [nodes, setNodes]);

  return (
    <div className={cn("relative w-full overflow-hidden bg-background", fillHeight ? "flex-1 min-h-[200px] h-full" : "h-[520px] rounded-xl border border-border")} ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.1}
        maxZoom={8}
        deleteKeyCode={null}
        selectionOnDrag
        panOnScroll
        className="bg-background"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} className="opacity-30" />
        <Controls
          showInteractive={false}
          className="!bg-background !border-border !rounded-lg !shadow-lg"
        />
        {!compact && (
          <MiniMap
            nodeColor={(n) => (n.data as MindMapNodeData)?.color || DEFAULT_COLOR}
            maskColor="hsl(var(--background) / 0.7)"
            className="!bg-muted !border-border !rounded-lg !shadow-lg"
            pannable
            zoomable
          />
        )}
      </ReactFlow>

      {/* Top toolbar */}
      <TooltipProvider delayDuration={300}>
        <div className={cn("absolute top-3 left-3 flex gap-1 z-10", compact && "top-2 left-2")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="secondary" onClick={handleAddNode} className={cn("shadow-md", compact ? "h-7 w-7 p-0" : "gap-1.5 h-8 text-xs")}>
                <Plus className="w-3.5 h-3.5" />
                {!compact && "Nó"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Adicionar nó (Tab)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="secondary" onClick={handleAutoLayout} className={cn("shadow-md", compact ? "h-7 w-7 p-0" : "gap-1.5 h-8 text-xs")}>
                <LayoutGrid className="w-3.5 h-3.5" />
                {!compact && "Organizar"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Organizar layout (⌘L)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)} className={cn("shadow-md", compact ? "h-7 w-7 p-0" : "gap-1.5 h-8 text-xs")}>
                <FileUp className="w-3.5 h-3.5" />
                {!compact && "Importar"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Importar de lista de tópicos</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" variant="secondary" onClick={handleExportImage} className={cn("shadow-md", compact ? "h-7 w-7 p-0" : "gap-1.5 h-8 text-xs")}>
                <FileDown className="w-3.5 h-3.5" />
                {!compact && "Exportar"}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Exportar como imagem PNG</TooltipContent>
          </Tooltip>
        </div>

        {/* Keyboard shortcuts hint */}
        <div className="absolute bottom-3 right-3 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-[10px] text-muted-foreground gap-1 opacity-60 hover:opacity-100"
                onClick={() => setShowShortcuts(!showShortcuts)}
              >
                <Keyboard className="w-3 h-3" /> Atalhos
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs space-y-1 p-3">
              <p><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Tab</kbd> Adicionar filho</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Enter</kbd> Editar nó</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Delete</kbd> Excluir nó</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">←→↑↓</kbd> Navegar entre nós</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">⌘L</kbd> Organizar</p>
              <p><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Duplo clique</kbd> Editar texto</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      <TopicImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImport={handleImport} />
    </div>
  );
}

export function MindMapEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <MindMapEditorInner {...props} />
    </ReactFlowProvider>
  );
}
