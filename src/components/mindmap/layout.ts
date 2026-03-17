import type { MindMapNode, MindMapEdge } from './types';

const H_GAP = 280;
const V_GAP = 20;
const NODE_HEIGHT = 48;

interface TreeNode {
  id: string;
  children: TreeNode[];
}

function buildTree(nodes: MindMapNode[], edges: MindMapEdge[]): TreeNode[] {
  const childrenMap: Record<string, string[]> = {};
  const hasParent = new Set<string>();
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  for (const e of edges) {
    if (!childrenMap[e.source]) childrenMap[e.source] = [];
    childrenMap[e.source].push(e.target);
    hasParent.add(e.target);
  }

  // Sort children by their current Y position to preserve visual order
  for (const parentId of Object.keys(childrenMap)) {
    childrenMap[parentId].sort((a, b) => {
      const na = nodeMap.get(a);
      const nb = nodeMap.get(b);
      return (na?.position.y ?? 0) - (nb?.position.y ?? 0);
    });
  }

  const roots = nodes.filter((n) => !hasParent.has(n.id));
  // Sort roots by Y position too
  roots.sort((a, b) => a.position.y - b.position.y);

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

/**
 * Reorder a sibling node up or down among its siblings.
 * Returns updated nodes with new positions after reordering.
 */
export function reorderSibling(
  nodeId: string,
  direction: 'up' | 'down',
  nodes: MindMapNode[],
  edges: MindMapEdge[],
): MindMapNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  
  // Find parent
  const parentEdge = edges.find((e) => e.target === nodeId);
  
  // Get siblings
  let siblingIds: string[];
  if (parentEdge) {
    siblingIds = edges
      .filter((e) => e.source === parentEdge.source)
      .map((e) => e.target);
  } else {
    // Root nodes
    const targets = new Set(edges.map((e) => e.target));
    siblingIds = nodes.filter((n) => !targets.has(n.id)).map((n) => n.id);
  }

  // Sort by current Y position
  siblingIds.sort((a, b) => {
    const na = nodeMap.get(a);
    const nb = nodeMap.get(b);
    return (na?.position.y ?? 0) - (nb?.position.y ?? 0);
  });

  const idx = siblingIds.indexOf(nodeId);
  if (idx === -1) return nodes;
  
  const newIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= siblingIds.length) return nodes;

  // Swap positions
  const swapId = siblingIds[newIdx];
  const currentNode = nodeMap.get(nodeId);
  const swapNode = nodeMap.get(swapId);
  if (!currentNode || !swapNode) return nodes;

  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, position: { ...swapNode.position } };
    if (n.id === swapId) return { ...n, position: { ...currentNode.position } };
    return n;
  });
}
