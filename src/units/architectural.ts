export type LengthUnit = 'inches' | 'feet' | 'millimeters' | 'centimeters' | 'meters';

export function parseArchitecturalFeet(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (!value) return null;

  const feetOnly = value.match(/^(-?\d+(?:\.\d+)?)\s*(?:ft|')$/);
  if (feetOnly) return Number(feetOnly[1]);

  const inchesOnly = value.match(/^(-?\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(?:in|")$/);
  if (inchesOnly) {
    const inches = parseMixedNumber(inchesOnly[1]);
    return inches == null ? null : inches / 12;
  }

  const feetInches = value.match(/^(-?\d+(?:\.\d+)?)\s*(?:ft|')\s*(?:-\s*)?(?:(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(?:in|")?)?$/);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = feetInches[2] ? parseMixedNumber(feetInches[2]) : 0;
    if (inches == null || !Number.isFinite(feet)) return null;
    const sign = feet < 0 ? -1 : 1;
    return feet + sign * inches / 12;
  }

  const bare = Number(value);
  return Number.isFinite(bare) ? bare : null;
}

export function formatArchitecturalFeet(feet: number, denominator = 16): string {
  if (!Number.isFinite(feet)) return '—';
  const sign = feet < 0 ? '-' : '';
  let absoluteInches = Math.abs(feet) * 12;
  let wholeFeet = Math.floor(absoluteInches / 12);
  absoluteInches -= wholeFeet * 12;

  let wholeInches = Math.floor(absoluteInches);
  let fractionNumerator = Math.round((absoluteInches - wholeInches) * denominator);
  if (fractionNumerator === denominator) {
    wholeInches += 1;
    fractionNumerator = 0;
  }
  if (wholeInches === 12) {
    wholeFeet += 1;
    wholeInches = 0;
  }

  const fraction = fractionNumerator === 0 ? '' : ` ${reduceFraction(fractionNumerator, denominator)}`;
  return `${sign}${wholeFeet}'-${wholeInches}${fraction}"`;
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  const meters = value * metersPerUnit(from);
  return meters / metersPerUnit(to);
}

function parseMixedNumber(value: string): number | null {
  const parts = value.trim().split(/\s+/);
  if (parts.length === 1) return parseFractionOrNumber(parts[0]);
  if (parts.length === 2) {
    const whole = Number(parts[0]);
    const fraction = parseFractionOrNumber(parts[1]);
    return Number.isFinite(whole) && fraction != null ? whole + fraction : null;
  }
  return null;
}

function parseFractionOrNumber(value: string): number | null {
  if (!value.includes('/')) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  const [numeratorText, denominatorText] = value.split('/');
  const numerator = Number(numeratorText);
  const denominator = Number(denominatorText);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return null;
  return numerator / denominator;
}

function reduceFraction(numerator: number, denominator: number) {
  const divisor = gcd(Math.abs(numerator), Math.abs(denominator));
  return `${numerator / divisor}/${denominator / divisor}`;
}

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a || 1;
}

function metersPerUnit(unit: LengthUnit) {
  switch (unit) {
    case 'inches': return 0.0254;
    case 'feet': return 0.3048;
    case 'millimeters': return 0.001;
    case 'centimeters': return 0.01;
    case 'meters': return 1;
  }
}
