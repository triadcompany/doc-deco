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
  theme?: string;
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

export function serialiseFromFlow(nodes: MindMapNode[], edges: MindMapEdge[], theme?: string): string {
  const data: MindMapSerialised = {
    type: 'mindmap',
    theme,
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

// ===== THEMES =====
export type NodeShape = 'rounded' | 'pill' | 'rectangle' | 'underline' | 'outline';
export type EdgeStyle = 'smoothstep' | 'bezier' | 'straight';

export interface MindMapTheme {
  id: string;
  name: string;
  colors: string[];
  rootColor: string;
  nodeShape: NodeShape;
  edgeStyle: EdgeStyle;
  bgDots: boolean;
  bgColor: string;
  edgeColor?: string;
}

export const MINDMAP_THEMES: MindMapTheme[] = [
  {
    id: 'classic',
    name: 'Clássico',
    colors: ['#0d9488', '#ef4444', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#f97316', '#ec4899'],
    rootColor: '#0d9488',
    nodeShape: 'rounded',
    edgeStyle: 'smoothstep',
    bgDots: true,
    bgColor: '#1e1e2e',
  },
  {
    id: 'ocean',
    name: 'Oceano',
    colors: ['#0ea5e9', '#06b6d4', '#2563eb', '#6366f1', '#0284c7', '#38bdf8', '#7dd3fc', '#818cf8'],
    rootColor: '#0c4a6e',
    nodeShape: 'pill',
    edgeStyle: 'bezier',
    bgDots: true,
    bgColor: '#0c1929',
    edgeColor: '#38bdf8',
  },
  {
    id: 'forest',
    name: 'Floresta',
    colors: ['#16a34a', '#65a30d', '#15803d', '#84cc16', '#22c55e', '#4ade80', '#a3e635', '#059669'],
    rootColor: '#14532d',
    nodeShape: 'rounded',
    edgeStyle: 'bezier',
    bgDots: true,
    edgeColor: '#4ade80',
  },
  {
    id: 'sunset',
    name: 'Pôr do Sol',
    colors: ['#f97316', '#ef4444', '#f59e0b', '#ec4899', '#fb923c', '#fbbf24', '#f87171', '#e11d48'],
    rootColor: '#9a3412',
    nodeShape: 'pill',
    edgeStyle: 'smoothstep',
    bgDots: true,
    edgeColor: '#fb923c',
  },
  {
    id: 'monochrome',
    name: 'Monocromático',
    colors: ['#525252', '#737373', '#404040', '#a3a3a3', '#6b7280', '#9ca3af', '#4b5563', '#d4d4d4'],
    rootColor: '#171717',
    nodeShape: 'rectangle',
    edgeStyle: 'straight',
    bgDots: false,
  },
  {
    id: 'candy',
    name: 'Candy',
    colors: ['#f472b6', '#c084fc', '#67e8f9', '#a78bfa', '#fda4af', '#86efac', '#fdba74', '#93c5fd'],
    rootColor: '#be185d',
    nodeShape: 'pill',
    edgeStyle: 'bezier',
    bgDots: true,
    edgeColor: '#f9a8d4',
  },
  {
    id: 'earth',
    name: 'Terra',
    colors: ['#92400e', '#b45309', '#78716c', '#a16207', '#854d0e', '#ca8a04', '#d97706', '#57534e'],
    rootColor: '#451a03',
    nodeShape: 'rectangle',
    edgeStyle: 'smoothstep',
    bgDots: false,
    edgeColor: '#d97706',
  },
  {
    id: 'neon',
    name: 'Neon',
    colors: ['#22d3ee', '#a855f7', '#f43f5e', '#10b981', '#facc15', '#f97316', '#3b82f6', '#ec4899'],
    rootColor: '#7c3aed',
    nodeShape: 'outline',
    edgeStyle: 'bezier',
    bgDots: true,
    edgeColor: '#a855f7',
  },
];

export function getThemeById(id?: string): MindMapTheme {
  return MINDMAP_THEMES.find((t) => t.id === id) || MINDMAP_THEMES[0];
}
