import type { CadPoint } from '../cad/types';
import type { WallCandidate } from './types';

type OffsetLine = { point: CadPoint; direction: CadPoint; wall: WallCandidate };

export function resolveInteriorRoomFace(
  centerlineBoundary: CadPoint[],
  walls: WallCandidate[],
  tolerance = 1e-4,
): { boundary: CadPoint[]; wallIds: string[] } | null {
  if (centerlineBoundary.length < 3) return null;
  const orientation = signedArea(centerlineBoundary);
  if (Math.abs(orientation) <= tolerance) return null;
  const interiorSign = orientation > 0 ? 1 : -1;
  const lines: OffsetLine[] = [];

  for (let index = 0; index < centerlineBoundary.length; index += 1) {
    const start = centerlineBoundary[index];
    const end = centerlineBoundary[(index + 1) % centerlineBoundary.length];
    const wall = walls.find(candidate => sameSegment(start, end, candidate.start, candidate.end, tolerance));
    if (!wall || wall.thickness <= 0) return null;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= tolerance) return null;
    const ux = dx / length;
    const uy = dy / length;
    const inward = { x: -uy * interiorSign, y: ux * interiorSign };
    const half = wall.thickness / 2;
    lines.push({
      point: { x: start.x + inward.x * half, y: start.y + inward.y * half },
      direction: { x: ux, y: uy },
      wall,
    });
  }

  const boundary: CadPoint[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const previous = lines[(index - 1 + lines.length) % lines.length];
    const current = lines[index];
    const intersection = intersectInfiniteLines(previous, current, tolerance);
    if (!intersection) return null;
    const centerlineVertex = centerlineBoundary[index];
    const maxMiter = Math.max(previous.wall.thickness, current.wall.thickness) * 8;
    if (Math.hypot(intersection.x - centerlineVertex.x, intersection.y - centerlineVertex.y) > maxMiter) return null;
    boundary.push(intersection);
  }

  if (Math.abs(signedArea(boundary)) <= tolerance) return null;
  return { boundary, wallIds: lines.map(line => line.wall.id) };
}

function intersectInfiniteLines(a: OffsetLine, b: OffsetLine, tolerance: number): CadPoint | null {
  const cross = a.direction.x * b.direction.y - a.direction.y * b.direction.x;
  if (Math.abs(cross) <= tolerance) return null;
  const qx = b.point.x - a.point.x;
  const qy = b.point.y - a.point.y;
  const t = (qx * b.direction.y - qy * b.direction.x) / cross;
  return { x: a.point.x + a.direction.x * t, y: a.point.y + a.direction.y * t };
}

function signedArea(points: CadPoint[]) {
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

function sameSegment(a1: CadPoint, a2: CadPoint, b1: CadPoint, b2: CadPoint, tolerance: number) {
  return (near(a1, b1, tolerance) && near(a2, b2, tolerance)) ||
    (near(a1, b2, tolerance) && near(a2, b1, tolerance));
}

function near(a: CadPoint, b: CadPoint, tolerance: number) {
  return Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
}
