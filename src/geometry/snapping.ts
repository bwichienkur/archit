export type SnapPoint = { x: number; y: number };
export type SnapKind = 'endpoint' | 'midpoint' | 'intersection' | 'center' | 'grid' | 'nearest';
export type SnapCandidate = { point: SnapPoint; kind: SnapKind; sourceId?: string; distance: number };

export type SnapSourceSegment = { id: string; a: SnapPoint; b: SnapPoint };

const dist = (a: SnapPoint, b: SnapPoint) => Math.hypot(a.x - b.x, a.y - b.y);

export function segmentIntersection(a: SnapSourceSegment, b: SnapSourceSegment): SnapPoint | null {
  const x1 = a.a.x, y1 = a.a.y, x2 = a.b.x, y2 = a.b.y;
  const x3 = b.a.x, y3 = b.a.y, x4 = b.b.x, y4 = b.b.y;
  const d = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(d) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / d;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
}

export function findSnap(
  cursor: SnapPoint,
  segments: SnapSourceSegment[],
  tolerance: number,
  gridSize?: number,
): SnapCandidate | null {
  const candidates: SnapCandidate[] = [];

  for (const segment of segments) {
    const midpoint = { x: (segment.a.x + segment.b.x) / 2, y: (segment.a.y + segment.b.y) / 2 };
    for (const [kind, point] of [['endpoint', segment.a], ['endpoint', segment.b], ['midpoint', midpoint]] as const) {
      const distance = dist(cursor, point);
      if (distance <= tolerance) candidates.push({ point, kind, sourceId: segment.id, distance });
    }
  }

  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      const point = segmentIntersection(segments[i], segments[j]);
      if (!point) continue;
      const distance = dist(cursor, point);
      if (distance <= tolerance) candidates.push({ point, kind: 'intersection', sourceId: `${segments[i].id}:${segments[j].id}`, distance });
    }
  }

  if (gridSize && gridSize > 0) {
    const point = { x: Math.round(cursor.x / gridSize) * gridSize, y: Math.round(cursor.y / gridSize) * gridSize };
    const distance = dist(cursor, point);
    if (distance <= tolerance) candidates.push({ point, kind: 'grid', distance });
  }

  const priority: Record<SnapKind, number> = { endpoint: 0, intersection: 1, midpoint: 2, center: 3, nearest: 4, grid: 5 };
  return candidates.sort((a, b) => priority[a.kind] - priority[b.kind] || a.distance - b.distance)[0] ?? null;
}
