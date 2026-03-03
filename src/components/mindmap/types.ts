import type { Node, Edge } from '@xyflow/react';

export interface MindMapNodeData {
  label: string;
  color: string;
  [key: string]: unknown;
}

export type MindMapNode = Node<MindMapNodeData>;
export type MindMapEdge = Edge;

export interface MindMapSerialised {
  type: 'mindmap';
  nodes: { id: string; label: string; color: string; position: { x: number; y: number } }[];
  edges: { id: string; source: string; target: string }[];
}

export function isMindMap(summary: string): boolean {
  try {
    return JSON.parse(summary)?.type === 'mindmap';
  } catch {
    return false;
  }
}

export function parseMindMap(summary: string): MindMapSerialised | null {
  try {
    const d = JSON.parse(summary);
    return d?.type === 'mindmap' ? d : null;
  } catch {
    return null;
  }
}

export function serialiseToNodes(data: MindMapSerialised): { nodes: MindMapNode[]; edges: MindMapEdge[] } {
  return {
    nodes: data.nodes.map((n) => ({
      id: n.id,
      type: 'mindMapNode',
      position: n.position,
      data: { label: n.label, color: n.color },
    })),
    edges: data.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
    })),
  };
}

export function serialiseFromFlow(nodes: MindMapNode[], edges: MindMapEdge[]): string {
  const data: MindMapSerialised = {
    type: 'mindmap',
    nodes: nodes.map((n) => ({
      id: n.id,
      label: (n.data as MindMapNodeData).label,
      color: (n.data as MindMapNodeData).color,
      position: n.position,
    })),
    edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
  return JSON.stringify(data);
}

export const NODE_COLORS = [
  '#0d9488', // teal
  '#ef4444', // red
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#f97316', // orange
  '#ec4899', // pink
];

export const DEFAULT_COLOR = '#0d9488';
