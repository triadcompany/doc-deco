import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LayoutGrid, FileDown, FileUp, Plus, Undo2, ZoomIn, Keyboard, Paintbrush } from 'lucide-react';
import { MindMapCustomNode } from './MindMapCustomNode';
import { TopicImportDialog } from './TopicImportDialog';
import { autoLayout, reorderSibling } from './layout';
import {
  DEFAULT_COLOR,
  NODE_COLORS,
  serialiseFromFlow,
  serialiseToNodes,
  parseMindMap,
  getThemeById,
  MINDMAP_THEMES,
  type MindMapNode,
  type MindMapEdge,
  type MindMapNodeData,
  type MindMapTheme,
} from './types';

const nodeTypes = { mindMapNode: MindMapCustomNode as any };

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

  const initialParsed = useMemo(() => initialValue ? parseMindMap(initialValue) : null, []);
  const [currentThemeId, setCurrentThemeId] = useState(() => initialParsed?.theme || 'classic');
  const theme = getThemeById(currentThemeId);

  const defaultEdgeOptions = useMemo(() => ({
    type: theme.edgeStyle === 'bezier' ? 'default' : theme.edgeStyle === 'straight' ? 'straight' : 'smoothstep',
    animated: false,
    style: { strokeWidth: 2, stroke: theme.edgeColor },
  }), [theme]);

  const initial = useMemo(() => {
    if (initialParsed) return serialiseToNodes(initialParsed);
    const rootId = nextId();
    return {
      nodes: [
        {
          id: rootId,
          type: 'mindMapNode',
          position: { x: 0, y: 0 },
          data: { label: 'Tema principal', color: theme.rootColor, nodeShape: theme.nodeShape },
        },
      ] as MindMapNode[],
      edges: [] as MindMapEdge[],
    };
  }, []);

  const [allNodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [allEdges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  // Compute descendants of collapsed nodes
  const hiddenIds = useMemo(() => {
    const hidden = new Set<string>();
    const childrenMap: Record<string, string[]> = {};
    for (const e of allEdges) {
      if (!childrenMap[e.source]) childrenMap[e.source] = [];
      childrenMap[e.source].push(e.target);
    }
    function hideDescendants(parentId: string) {
      for (const childId of childrenMap[parentId] || []) {
        hidden.add(childId);
        hideDescendants(childId);
      }
    }
    for (const id of collapsedIds) {
      hideDescendants(id);
    }
    return hidden;
  }, [allEdges, collapsedIds]);

  // Compute child counts for each node
  const childCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of allEdges) {
      map[e.source] = (map[e.source] || 0) + 1;
    }
    return map;
  }, [allEdges]);

  // Visible nodes with collapse metadata injected
  const nodes = useMemo(() =>
    allNodes
      .filter((n) => !hiddenIds.has(n.id))
      .map((n) => ({
        ...n,
        data: {
          ...n.data,
          collapsed: collapsedIds.has(n.id),
          childCount: childCountMap[n.id] || 0,
        },
      })),
    [allNodes, hiddenIds, collapsedIds, childCountMap],
  );

  const edges = useMemo(() =>
    allEdges.filter((e) => !hiddenIds.has(e.target)),
    [allEdges, hiddenIds],
  );

  // Emit changes (use allNodes/allEdges to preserve hidden data)
  useEffect(() => {
    onChange?.(serialiseFromFlow(allNodes as MindMapNode[], allEdges, currentThemeId));
  }, [allNodes, allEdges, onChange]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({ ...params, ...defaultEdgeOptions }, eds));
    },
    [setEdges, defaultEdgeOptions],
  );

  // Custom event handlers
  useEffect(() => {
    const handleAddChild = (e: Event) => {
      const { parentId } = (e as CustomEvent).detail;
      const childId = nextId();
      setNodes((nds) => {
        const parent = nds.find((n) => n.id === parentId);
        const parentPos = parent?.position || { x: 0, y: 0 };
        const parentColor = (parent?.data as MindMapNodeData)?.color || theme.rootColor;
        const siblingCount = edges.filter((ed) => ed.source === parentId).length;
        const colors = theme.colors;
        const colorIndex = (colors.indexOf(parentColor) + 1 + siblingCount) % colors.length;
        return [
          ...nds.map((n) => ({ ...n, selected: false })),
          {
            id: childId,
            type: 'mindMapNode',
            position: { x: parentPos.x + 300, y: parentPos.y + siblingCount * 72 },
            data: { label: '', color: colors[colorIndex], nodeShape: theme.nodeShape },
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

    const handleReorder = (e: Event) => {
      const { id, direction } = (e as CustomEvent).detail;
      setNodes((nds) => reorderSibling(id, direction, nds as MindMapNode[], allEdges));
    };

    const handleToggleCollapse = (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      setCollapsedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    window.addEventListener('mindmap:add-child', handleAddChild);
    window.addEventListener('mindmap:delete-node', handleDeleteNode);
    window.addEventListener('mindmap:update-node', handleUpdateNode);
    window.addEventListener('mindmap:reorder', handleReorder);
    window.addEventListener('mindmap:toggle-collapse', handleToggleCollapse);
    return () => {
      window.removeEventListener('mindmap:add-child', handleAddChild);
      window.removeEventListener('mindmap:delete-node', handleDeleteNode);
      window.removeEventListener('mindmap:update-node', handleUpdateNode);
      window.removeEventListener('mindmap:reorder', handleReorder);
      window.removeEventListener('mindmap:toggle-collapse', handleToggleCollapse);
    };
  }, [setNodes, setEdges, allEdges]);

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
              data: { label: '', color: theme.rootColor, nodeShape: theme.nodeShape },
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

      // Alt+Arrow → reorder sibling
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && e.altKey && selected) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('mindmap:reorder', { 
          detail: { id: selected.id, direction: e.key === 'ArrowUp' ? 'up' : 'down' } 
        }));
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
      const laid = autoLayout(nds as MindMapNode[], allEdges);
      setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 50);
      return laid;
    });
  }, [allEdges, setNodes, fitView]);

  const handleExportImage = useCallback(async () => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow__viewport') as HTMLElement;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: theme.bgColor,
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
          data: { label: '', color: theme.rootColor, nodeShape: theme.nodeShape },
          selected: true,
        },
      ]);
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('mindmap:start-edit', { detail: { id } }));
      }, 100);
    }
  }, [nodes, setNodes, theme]);

  const applyTheme = useCallback((newTheme: MindMapTheme) => {
    setCurrentThemeId(newTheme.id);
    setNodes((nds) => {
      const targetIds = new Set(allEdges.map((e) => e.target));
      return nds.map((n, i) => {
        const isRoot = !targetIds.has(n.id);
        const colorIdx = i % newTheme.colors.length;
        return {
          ...n,
          data: {
            ...n.data,
            color: isRoot ? newTheme.rootColor : newTheme.colors[colorIdx],
            nodeShape: newTheme.nodeShape,
          },
        };
      });
    });
    setEdges((eds) => eds.map((e) => ({
      ...e,
      type: newTheme.edgeStyle === 'bezier' ? 'default' : newTheme.edgeStyle === 'straight' ? 'straight' : 'smoothstep',
      style: { ...e.style, stroke: newTheme.edgeColor },
    })));
  }, [setNodes, setEdges, allEdges]);

  return (
    <div className={cn("relative w-full overflow-hidden", fillHeight ? "flex-1 min-h-[200px] h-full" : "h-[60vh] min-h-[300px] max-h-[700px] rounded-xl border border-border")} ref={reactFlowWrapper} style={{ backgroundColor: theme.bgColor }}>
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
        style={{ backgroundColor: theme.bgColor }}
        proOptions={{ hideAttribution: true }}
      >
        {theme.bgDots && <Background variant={BackgroundVariant.Dots} gap={24} size={1} className="opacity-30" />}
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
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="secondary" className={cn("shadow-md", compact ? "h-7 w-7 p-0" : "gap-1.5 h-8 text-xs")}>
                    <Paintbrush className="w-3.5 h-3.5" />
                    {!compact && "Tema"}
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Alterar tema visual</TooltipContent>
            </Tooltip>
            <PopoverContent side="bottom" align="start" className="w-64 p-2">
              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">Temas</p>
              <div className="grid grid-cols-2 gap-1.5">
                {MINDMAP_THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTheme(t)}
                    className={cn(
                      "flex flex-col items-start gap-1.5 p-2 rounded-lg border transition-all text-left hover:bg-accent",
                      currentThemeId === t.id ? "border-primary bg-accent" : "border-border"
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded border border-border/50" style={{ backgroundColor: t.bgColor }} />
                      <span className="text-xs font-medium">{t.name}</span>
                    </div>
                    <div className="flex gap-0.5">
                      {t.colors.slice(0, 5).map((c, i) => (
                        <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
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
              <p><kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Alt+↑↓</kbd> Reordenar</p>
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
