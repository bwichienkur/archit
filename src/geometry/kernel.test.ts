import { describe, expect, it } from 'vitest';
import { distance, midpoint, pointInPolygon, polygonArea, projectPointToSegment } from './kernel';

describe('geometry kernel', () => {
  it('calculates exact segment distance', () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('calculates a midpoint without mutating points', () => {
    expect(midpoint({ x: 0, y: 2 }, { x: 10, y: 6 })).toEqual({ x: 5, y: 4 });
  });

  it('projects a point onto a bounded segment', () => {
    expect(projectPointToSegment({ x: 5, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 0 });
    expect(projectPointToSegment({ x: 15, y: 4 }, { x: 0, y: 0 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0 });
  });

  it('computes polygon area and containment', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(polygonArea(square)).toBe(100);
    expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
  });
});
