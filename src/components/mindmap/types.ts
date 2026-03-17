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
export type NodeShape = 'rounded' | 'rectangle';
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
    id: 'professional',
    name: 'Profissional',
    colors: ['#1e40af', '#334155', '#475569', '#1e3a5f', '#3b5998', '#2c3e50', '#1a365d', '#4a5568'],
    rootColor: '#0f172a',
    nodeShape: 'rounded',
    edgeStyle: 'smoothstep',
    bgDots: true,
    bgColor: '#f8fafc',
  },
  {
    id: 'corporate',
    name: 'Corporativo',
    colors: ['#0369a1', '#0e7490', '#155e75', '#164e63', '#1d4ed8', '#1e40af', '#0c4a6e', '#075985'],
    rootColor: '#082f49',
    nodeShape: 'rounded',
    edgeStyle: 'smoothstep',
    bgDots: false,
    bgColor: '#f0f9ff',
    edgeColor: '#94a3b8',
  },
  {
    id: 'dark',
    name: 'Escuro',
    colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'],
    rootColor: '#e2e8f0',
    nodeShape: 'rounded',
    edgeStyle: 'smoothstep',
    bgDots: true,
    bgColor: '#0f172a',
    edgeColor: '#475569',
  },
  {
    id: 'warm',
    name: 'Quente',
    colors: ['#b91c1c', '#c2410c', '#a16207', '#b45309', '#9a3412', '#92400e', '#854d0e', '#991b1b'],
    rootColor: '#450a0a',
    nodeShape: 'rounded',
    edgeStyle: 'bezier',
    bgDots: false,
    bgColor: '#fef7ed',
    edgeColor: '#d6b589',
  },
  {
    id: 'pastel',
    name: 'Pastel',
    colors: ['#93c5fd', '#86efac', '#fda4af', '#c4b5fd', '#fcd34d', '#a5f3fc', '#fdba74', '#f0abfc'],
    rootColor: '#6366f1',
    nodeShape: 'rounded',
    edgeStyle: 'bezier',
    bgDots: true,
    bgColor: '#fefefe',
    edgeColor: '#cbd5e1',
  },
  {
    id: 'contrast',
    name: 'Alto Contraste',
    colors: ['#dc2626', '#2563eb', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#c026d3', '#0d9488'],
    rootColor: '#000000',
    nodeShape: 'rectangle',
    edgeStyle: 'straight',
    bgDots: false,
    bgColor: '#ffffff',
    edgeColor: '#374151',
  },
  {
    id: 'midnight',
    name: 'Meia-noite',
    colors: ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#fb923c', '#f472b6'],
    rootColor: '#f1f5f9',
    nodeShape: 'rounded',
    edgeStyle: 'bezier',
    bgDots: true,
    bgColor: '#1a1a2e',
    edgeColor: '#374151',
  },
  {
    id: 'nature',
    name: 'Natureza',
    colors: ['#166534', '#3f6212', '#1e3a5f', '#713f12', '#4d7c0f', '#065f46', '#854d0e', '#115e59'],
    rootColor: '#052e16',
    nodeShape: 'rounded',
    edgeStyle: 'bezier',
    bgDots: false,
    bgColor: '#f0fdf4',
    edgeColor: '#86efac',
  },
];

export function getThemeById(id?: string): MindMapTheme {
  return MINDMAP_THEMES.find((t) => t.id === id) || MINDMAP_THEMES[0];
}
