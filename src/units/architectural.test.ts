import { describe, expect, it } from 'vitest';
import { convertLength, formatArchitecturalFeet, parseArchitecturalFeet } from './architectural';

describe('architectural units', () => {
  it('parses feet and fractional inches', () => {
    expect(parseArchitecturalFeet(`12' 3 1/2"`)).toBeCloseTo(12 + 3.5 / 12);
    expect(parseArchitecturalFeet(`3'-6"`)).toBeCloseTo(3.5);
    expect(parseArchitecturalFeet(`42"`)).toBeCloseTo(3.5);
  });

  it('formats feet using reduced fractional inches', () => {
    expect(formatArchitecturalFeet(12 + 3.5 / 12)).toBe(`12'-3 1/2"`);
    expect(formatArchitecturalFeet(-3.5)).toBe(`-3'-6"`);
  });

  it('converts exact construction units', () => {
    expect(convertLength(12, 'inches', 'feet')).toBeCloseTo(1);
    expect(convertLength(1, 'meters', 'millimeters')).toBeCloseTo(1000);
  });
});
