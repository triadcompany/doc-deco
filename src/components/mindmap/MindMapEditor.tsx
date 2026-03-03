import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
  BackgroundVariant,
  type Connection,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import { Button } from '@/components/ui/button';
import { LayoutGrid, FileDown, FileUp, Plus } from 'lucide-react';
import { MindMapCustomNode } from './MindMapCustomNode';
import { TopicImportDialog } from './TopicImportDialog';
import { autoLayout } from './layout';
import {
  DEFAULT_COLOR,
  serialiseFromFlow,
  serialiseToNodes,
  parseMindMap,
  type MindMapNode,
  type MindMapEdge,
  type MindMapNodeData,
} from './types';

const nodeTypes = { mindMapNode: MindMapCustomNode as any };

interface Props {
  initialValue?: string;
  onChange?: (json: string) => void;
}

let idCounter = 1;
function nextId() {
  return `mm_${Date.now()}_${idCounter++}`;
}

function MindMapEditorInner({ initialValue, onChange }: Props) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const [importOpen, setImportOpen] = useState(false);

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
      setEdges((eds) => addEdge({ ...params, type: 'smoothstep' }, eds));
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
        // Count existing children to offset vertically
        const siblingCount = edges.filter((ed) => ed.source === parentId).length;
        return [
          ...nds,
          {
            id: childId,
            type: 'mindMapNode',
            position: { x: parentPos.x + 280, y: parentPos.y + siblingCount * 64 },
            data: { label: 'Novo tópico', color: DEFAULT_COLOR },
          },
        ];
      });
      setEdges((eds) => [...eds, { id: `e${parentId}-${childId}`, source: parentId, target: childId, type: 'smoothstep' }]);
    };

    const handleDeleteNode = (e: Event) => {
      const { id } = (e as CustomEvent).detail;
      setNodes((nds) => nds.filter((n) => n.id !== id));
      setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
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
  }, [setNodes, setEdges, fitView]);

  // Tab key → add child from selected node
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      // Don't intercept if user is typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      const selected = nodes.find((n) => n.selected);
      if (!selected) return;

      e.preventDefault();
      window.dispatchEvent(new CustomEvent('mindmap:add-child', { detail: { parentId: selected.id } }));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nodes]);

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => {
      const laid = autoLayout(nds as MindMapNode[], edges);
      setTimeout(() => fitView({ duration: 300 }), 50);
      return laid;
    });
  }, [edges, setNodes, fitView]);

  const handleExportImage = useCallback(async () => {
    const el = reactFlowWrapper.current?.querySelector('.react-flow__viewport') as HTMLElement;
    if (!el) return;
    try {
      const dataUrl = await toPng(el, {
        backgroundColor: '#1a1a2e',
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
      setTimeout(() => fitView({ duration: 300 }), 100);
    },
    [setNodes, setEdges, fitView],
  );

  const handleAddRoot = useCallback(() => {
    const id = nextId();
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'mindMapNode',
        position: { x: 0, y: (nds.length + 1) * 80 },
        data: { label: 'Novo tópico', color: DEFAULT_COLOR },
      },
    ]);
  }, [setNodes]);

  return (
    <div className="relative w-full h-[500px] rounded-lg border border-border overflow-hidden" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode="Delete"
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>

      {/* Toolbar */}
      <div className="absolute top-2 left-2 flex gap-1.5 z-10">
        <Button size="sm" variant="secondary" onClick={handleAddRoot} className="gap-1 h-8 text-xs">
          <Plus className="w-3.5 h-3.5" /> Nó
        </Button>
        <Button size="sm" variant="secondary" onClick={handleAutoLayout} className="gap-1 h-8 text-xs">
          <LayoutGrid className="w-3.5 h-3.5" /> Organizar
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setImportOpen(true)} className="gap-1 h-8 text-xs">
          <FileUp className="w-3.5 h-3.5" /> Importar
        </Button>
        <Button size="sm" variant="secondary" onClick={handleExportImage} className="gap-1 h-8 text-xs">
          <FileDown className="w-3.5 h-3.5" /> Exportar
        </Button>
      </div>

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
