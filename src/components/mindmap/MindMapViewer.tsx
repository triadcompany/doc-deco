import { useMemo } from 'react';
import { ReactFlow, Controls, Background, BackgroundVariant, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { MindMapCustomNode } from './MindMapCustomNode';
import { parseMindMap, serialiseToNodes } from './types';

const nodeTypes = { mindMapNode: MindMapCustomNode as any };

interface Props {
  value: string;
  className?: string;
  interactive?: boolean;
}

function MindMapViewerInner({ value, className, interactive = false }: Props) {
  const { nodes, edges } = useMemo(() => {
    const parsed = parseMindMap(value);
    if (!parsed) return { nodes: [], edges: [] };
    return serialiseToNodes(parsed);
  }, [value]);

  if (nodes.length === 0) return null;

  return (
    <div className={className || 'w-full h-[400px]'}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={interactive}
        nodesConnectable={false}
        elementsSelectable={interactive}
        panOnDrag={interactive}
        zoomOnScroll={interactive}
        preventScrolling={interactive}
        className="bg-background rounded-lg"
      >
        {interactive && (
          <>
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
            <Controls showInteractive={false} />
          </>
        )}
      </ReactFlow>
    </div>
  );
}

export function MindMapViewer(props: Props) {
  return (
    <ReactFlowProvider>
      <MindMapViewerInner {...props} />
    </ReactFlowProvider>
  );
}
