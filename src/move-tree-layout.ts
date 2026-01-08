import type { MoveTree } from './kif-viewer';

export interface MoveTreeLayoutOptions {
  nodeWidth: number;
  nodeHeight: number;
  colGap: number;
  rowGap: number;
}

export interface MoveTreeLayoutNode {
  id: string;
  label: string;
  ply: number;
  laneIndex: number;
  subtreeHeight: number;
  x: number;
  y: number;
}

export interface MoveTreeLayoutEdge {
  fromId: string;
  toId: string;
}

export interface MoveTreeLayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface MoveTreeLayoutResult {
  nodes: Record<string, MoveTreeLayoutNode>;
  edges: MoveTreeLayoutEdge[];
  bounds: MoveTreeLayoutBounds;
}

export function calculateNodePosition(
  ply: number,
  laneIndex: number,
  options: MoveTreeLayoutOptions,
): { x: number; y: number } {
  const x = (ply - 1) * (options.nodeWidth + options.colGap);
  const y = laneIndex * (options.nodeHeight + options.rowGap);
  return { x, y };
}

function computeSubtreeHeight(
  tree: MoveTree,
  nodeId: string,
  memo: Map<string, number>,
): number {
  const cached = memo.get(nodeId);
  if (cached !== undefined) {
    return cached;
  }
  const node = tree.nodes[nodeId];
  if (!node || node.childIds.length === 0) {
    memo.set(nodeId, 1);
    return 1;
  }
  const [firstChild, ...restChildren] = node.childIds;
  let height = 1;
  if (firstChild) {
    height = Math.max(1, computeSubtreeHeight(tree, firstChild, memo));
  }
  for (const childId of restChildren) {
    height += computeSubtreeHeight(tree, childId, memo);
  }
  memo.set(nodeId, height);
  return height;
}

function assignLanes(
  tree: MoveTree,
  nodeId: string,
  laneIndex: number,
  subtreeHeights: Map<string, number>,
  laneMap: Map<string, number>,
): void {
  laneMap.set(nodeId, laneIndex);
  const node = tree.nodes[nodeId];
  if (!node || node.childIds.length === 0) {
    return;
  }
  const [firstChild, ...restChildren] = node.childIds;
  let nextLane = laneIndex;
  if (firstChild) {
    assignLanes(tree, firstChild, laneIndex, subtreeHeights, laneMap);
    nextLane = laneIndex + Math.max(1, subtreeHeights.get(firstChild) ?? 1);
  }
  for (const childId of restChildren) {
    assignLanes(tree, childId, nextLane, subtreeHeights, laneMap);
    nextLane += Math.max(1, subtreeHeights.get(childId) ?? 1);
  }
}

export function layoutMoveTree(
  tree: MoveTree,
  options: MoveTreeLayoutOptions,
): MoveTreeLayoutResult {
  const subtreeHeights = new Map<string, number>();
  computeSubtreeHeight(tree, tree.rootId, subtreeHeights);

  const laneMap = new Map<string, number>();
  assignLanes(tree, tree.rootId, 0, subtreeHeights, laneMap);

  const nodes: Record<string, MoveTreeLayoutNode> = {};
  const edges: MoveTreeLayoutEdge[] = [];

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const [id, node] of Object.entries(tree.nodes)) {
    const laneIndex = laneMap.get(id) ?? 0;
    const subtreeHeight = subtreeHeights.get(id) ?? 1;
    const { x, y } = calculateNodePosition(node.ply, laneIndex, options);
    nodes[id] = {
      id,
      label: node.label,
      ply: node.ply,
      laneIndex,
      subtreeHeight,
      x,
      y,
    };

    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + options.nodeWidth);
    maxY = Math.max(maxY, y + options.nodeHeight);

    for (const childId of node.childIds) {
      edges.push({ fromId: id, toId: childId });
    }
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 0;
    maxY = 0;
  }

  return {
    nodes,
    edges,
    bounds: {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY),
    },
  };
}
