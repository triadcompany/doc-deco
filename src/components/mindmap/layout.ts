import type { MindMapNode, MindMapEdge } from './types';

const H_GAP = 300;
const V_GAP = 24;
const NODE_HEIGHT = 48;

interface TreeNode {
  id: string;
  children: TreeNode[];
}

function buildTree(nodes: MindMapNode[], edges: MindMapEdge[]): TreeNode[] {
  const childrenMap: Record<string, string[]> = {};
  const hasParent = new Set<string>();

  for (const e of edges) {
    if (!childrenMap[e.source]) childrenMap[e.source] = [];
    childrenMap[e.source].push(e.target);
    hasParent.add(e.target);
  }

  const roots = nodes.filter((n) => !hasParent.has(n.id));

  function build(id: string): TreeNode {
    const kids = (childrenMap[id] || []).map(build);
    return { id, children: kids };
  }

  return roots.length > 0 ? roots.map((r) => build(r.id)) : nodes.length > 0 ? [build(nodes[0].id)] : [];
}

function subtreeHeight(node: TreeNode): number {
  if (node.children.length === 0) return NODE_HEIGHT;
  const total = node.children.reduce((s, c) => s + subtreeHeight(c), 0) + (node.children.length - 1) * V_GAP;
  return Math.max(NODE_HEIGHT, total);
}

function assignPositions(
  node: TreeNode,
  x: number,
  yStart: number,
  result: Record<string, { x: number; y: number }>,
) {
  const h = subtreeHeight(node);
  result[node.id] = { x, y: yStart + h / 2 - NODE_HEIGHT / 2 };

  let currentY = yStart;
  for (const child of node.children) {
    const ch = subtreeHeight(child);
    assignPositions(child, x + H_GAP, currentY, result);
    currentY += ch + V_GAP;
  }
}

export function autoLayout(nodes: MindMapNode[], edges: MindMapEdge[]): MindMapNode[] {
  const trees = buildTree(nodes, edges);
  const positions: Record<string, { x: number; y: number }> = {};

  let yOffset = 0;
  for (const tree of trees) {
    assignPositions(tree, 0, yOffset, positions);
    yOffset += subtreeHeight(tree) + V_GAP * 3;
  }

  return nodes.map((n) => ({
    ...n,
    position: positions[n.id] || n.position,
  }));
}
