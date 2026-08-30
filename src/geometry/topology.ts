import type { Vec2 } from '../domain/model';

export type TopologyVertex = {
  id: string;
  point: Vec2;
  edgeIds: string[];
};

export type TopologyEdge = {
  id: string;
  startVertexId: string;
  endVertexId: string;
  sourceIds: string[];
};

export type PlanarTopology = {
  vertices: TopologyVertex[];
  edges: TopologyEdge[];
};

export function buildEndpointTopology(
  segments: Array<{ id: string; start: Vec2; end: Vec2; sourceIds?: string[] }>,
  tolerance = 1e-4,
): PlanarTopology {
  const vertices = new Map<string, TopologyVertex>();
  const edges: TopologyEdge[] = [];

  const getVertex = (point: Vec2) => {
    const key = `${Math.round(point.x / tolerance)}:${Math.round(point.y / tolerance)}`;
    let vertex = vertices.get(key);
    if (!vertex) {
      vertex = { id: `v:${key}`, point: { ...point }, edgeIds: [] };
      vertices.set(key, vertex);
    }
    return vertex;
  };

  for (const segment of segments) {
    const start = getVertex(segment.start);
    const end = getVertex(segment.end);
    if (start.id === end.id) continue;
    const edge: TopologyEdge = {
      id: segment.id,
      startVertexId: start.id,
      endVertexId: end.id,
      sourceIds: segment.sourceIds ?? [segment.id],
    };
    edges.push(edge);
    start.edgeIds.push(edge.id);
    end.edgeIds.push(edge.id);
  }

  return { vertices: [...vertices.values()], edges };
}

export function findPlanarFaces(topology: PlanarTopology): Vec2[][] {
  const vertexById = new Map(topology.vertices.map(vertex => [vertex.id, vertex]));
  const edgeById = new Map(topology.edges.map(edge => [edge.id, edge]));
  const neighbors = new Map<string, string[]>();

  for (const vertex of topology.vertices) neighbors.set(vertex.id, []);
  for (const edge of topology.edges) {
    neighbors.get(edge.startVertexId)?.push(edge.endVertexId);
    neighbors.get(edge.endVertexId)?.push(edge.startVertexId);
  }

  for (const [vertexId, adjacent] of neighbors) {
    const origin = vertexById.get(vertexId)!.point;
    adjacent.sort((a, b) => angle(origin, vertexById.get(a)!.point) - angle(origin, vertexById.get(b)!.point));
  }

  const visited = new Set<string>();
  const faces: Vec2[][] = [];
  const edgeKey = (from: string, to: string) => `${from}->${to}`;

  for (const edge of topology.edges) {
    for (const [from, to] of [[edge.startVertexId, edge.endVertexId], [edge.endVertexId, edge.startVertexId]] as const) {
      if (visited.has(edgeKey(from, to))) continue;
      const faceIds: string[] = [];
      let currentFrom = from;
      let currentTo = to;
      let guard = 0;

      while (guard++ < topology.edges.length * 4 + 8) {
        const directed = edgeKey(currentFrom, currentTo);
        if (visited.has(directed)) break;
        visited.add(directed);
        faceIds.push(currentFrom);

        const adjacent = neighbors.get(currentTo) ?? [];
        const incomingIndex = adjacent.indexOf(currentFrom);
        if (incomingIndex < 0 || adjacent.length === 0) break;
        const nextIndex = (incomingIndex - 1 + adjacent.length) % adjacent.length;
        const next = adjacent[nextIndex];
        currentFrom = currentTo;
        currentTo = next;

        if (currentFrom === from && currentTo === to) {
          if (faceIds.length >= 3) faces.push(faceIds.map(id => vertexById.get(id)!.point));
          break;
        }
      }
    }
  }

  const bounded = faces.filter(face => signedArea(face) > 1e-8);
  return dedupeFaces(bounded);
}

function dedupeFaces(faces: Vec2[][]): Vec2[][] {
  const seen = new Set<string>();
  const unique: Vec2[][] = [];
  for (const face of faces) {
    const normalized = normalizeCycle(face);
    const key = normalized.map(point => `${point.x.toFixed(6)},${point.y.toFixed(6)}`).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(face);
  }
  return unique;
}

function normalizeCycle(points: Vec2[]): Vec2[] {
  if (points.length === 0) return points;
  let start = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i];
    const b = points[start];
    if (a.x < b.x || (a.x === b.x && a.y < b.y)) start = i;
  }
  return [...points.slice(start), ...points.slice(0, start)];
}

function angle(a: Vec2, b: Vec2) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function signedArea(points: Vec2[]) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}
