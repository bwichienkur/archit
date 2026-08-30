import type { ArchitecturalWall, Point2, WallOpening } from './building';

export type WallJoinKind = 'end' | 'corner' | 'tee' | 'cross' | 'multi';

export type WallJoinNode = {
  id: string;
  point: Point2;
  wallIds: string[];
  kind: WallJoinKind;
};

export type WallJoinGraph = {
  nodes: WallJoinNode[];
  wallNodeIds: Record<string, { start: string; end: string }>;
};

export function buildWallJoinGraph(walls: ArchitecturalWall[], tolerance = 1e-4): WallJoinGraph {
  const nodes = new Map<string, WallJoinNode>();
  const wallNodeIds: Record<string, { start: string; end: string }> = {};

  const getNode = (point: Point2) => {
    const key = `${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
    let node = nodes.get(key);
    if (!node) {
      node = { id: `join:${key}`, point: { ...point }, wallIds: [], kind: 'end' };
      nodes.set(key, node);
    }
    return node;
  };

  for (const wall of walls) {
    const start = getNode(wall.start);
    const end = getNode(wall.end);
    if (!start.wallIds.includes(wall.id)) start.wallIds.push(wall.id);
    if (!end.wallIds.includes(wall.id)) end.wallIds.push(wall.id);
    wallNodeIds[wall.id] = { start: start.id, end: end.id };
  }

  const resultNodes = [...nodes.values()].map(node => ({ ...node, kind: classifyJoin(node, walls) }));
  return { nodes: resultNodes, wallNodeIds };
}

export function openingCenter(opening: WallOpening, wall: ArchitecturalWall): Point2 {
  if (opening.hostWallId !== wall.id) throw new Error(`Opening ${opening.id} is not hosted by wall ${wall.id}.`);
  const length = wallLength(wall);
  if (length <= 0) throw new Error(`Wall ${wall.id} has zero length.`);
  const centerDistance = opening.offsetFromWallStart + opening.width / 2;
  const t = centerDistance / length;
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * t,
    y: wall.start.y + (wall.end.y - wall.start.y) * t,
  };
}

export function validateHostedOpening(opening: WallOpening, wall: ArchitecturalWall) {
  const issues: string[] = [];
  if (opening.hostWallId !== wall.id) issues.push('Opening host wall does not match supplied wall.');
  if (opening.width <= 0 || opening.height <= 0) issues.push('Opening width and height must be positive.');
  if (opening.offsetFromWallStart < 0) issues.push('Opening offset cannot be negative.');
  const end = opening.offsetFromWallStart + opening.width;
  const length = wallLength(wall);
  if (end > length) issues.push(`Opening extends ${(end - length).toFixed(4)} units beyond the wall end.`);
  if (opening.kind === 'window' && (opening.sillHeight ?? 0) + opening.height > wall.height) issues.push('Window head exceeds wall height.');
  if (opening.height > wall.height) issues.push('Opening height exceeds wall height.');
  return issues;
}

export function wallLength(wall: Pick<ArchitecturalWall, 'start' | 'end'>) {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

function classifyJoin(node: WallJoinNode, walls: ArchitecturalWall[]): WallJoinKind {
  const degree = node.wallIds.length;
  if (degree <= 1) return 'end';
  if (degree === 2) {
    const [a, b] = node.wallIds.map(id => walls.find(wall => wall.id === id)).filter(Boolean) as ArchitecturalWall[];
    if (!a || !b) return 'corner';
    const av = directionAwayFrom(a, node.point);
    const bv = directionAwayFrom(b, node.point);
    const cross = Math.abs(av.x * bv.y - av.y * bv.x);
    return cross < 1e-5 ? 'end' : 'corner';
  }
  if (degree === 3) return 'tee';
  if (degree === 4) return 'cross';
  return 'multi';
}

function directionAwayFrom(wall: ArchitecturalWall, node: Point2) {
  const other = near(wall.start, node) ? wall.end : wall.start;
  const dx = other.x - node.x;
  const dy = other.y - node.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function near(a: Point2, b: Point2, tolerance = 1e-5) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}
