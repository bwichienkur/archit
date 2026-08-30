import { describe, expect, it } from 'vitest';
import { calculateLinearTrim, calculateSurfaceTakeoff, calculateUnitsNeeded } from './takeoff';

describe('builder takeoffs', () => {
  it('subtracts openings and applies waste', () => {
    const result = calculateSurfaceTakeoff({ width: 8, height: 10, openings: [{ width: 3, height: 5 }], wasteFactor: 0.10 });
    expect(result.grossArea).toBe(80);
    expect(result.openingArea).toBe(15);
    expect(result.netArea).toBe(65);
    expect(result.orderArea).toBeCloseTo(71.5);
  });

  it('calculates linear trim after excluded openings', () => {
    expect(calculateLinearTrim(50, [3, 4], 0.1)).toBeCloseTo(47.3);
  });

  it('rounds purchasable units up', () => {
    expect(calculateUnitsNeeded(71.5, 12)).toBe(6);
  });
});
