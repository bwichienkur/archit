import { describe, expect, it } from 'vitest';
import { buildEndpointTopology, findPlanarFaces } from './topology';
import { polygonArea } from './kernel';

describe('planar topology', () => {
  it('finds one bounded face for a rectangle', () => {
    const topology = buildEndpointTopology([
      { id: 'a', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { id: 'b', start: { x: 10, y: 0 }, end: { x: 10, y: 8 } },
      { id: 'c', start: { x: 10, y: 8 }, end: { x: 0, y: 8 } },
      { id: 'd', start: { x: 0, y: 8 }, end: { x: 0, y: 0 } },
    ]);

    const faces = findPlanarFaces(topology);
    expect(faces).toHaveLength(1);
    expect(polygonArea(faces[0])).toBeCloseTo(80);
  });

  it('snaps nearly coincident endpoints using tolerance', () => {
    const topology = buildEndpointTopology([
      { id: 'a', start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
      { id: 'b', start: { x: 10.00001, y: 0 }, end: { x: 10, y: 8 } },
    ], 0.001);

    expect(topology.vertices).toHaveLength(3);
  });
});
