import { describe, expect, it } from 'vitest';
import { FIELD, fieldPositions } from './waves';

describe('particle wave field', () => {
  it('is a flat grid spanning the field, near to far', () => {
    const p = fieldPositions(10, 6);
    expect(p).toHaveLength(10 * 6 * 3);
    const xs: number[] = [], zs: number[] = [];
    for (let i = 0; i < p.length; i += 3) {
      xs.push(p[i]!);
      expect(p[i + 1]).toBe(0);
      zs.push(p[i + 2]!);
    }
    expect(Math.min(...xs)).toBeCloseTo(-FIELD.width / 2, 9);
    expect(Math.max(...xs)).toBeCloseTo(FIELD.width / 2, 9);
    expect(Math.max(...zs)).toBeCloseTo(FIELD.near, 9);
    expect(Math.min(...zs)).toBeCloseTo(FIELD.near - FIELD.depth, 9);
  });

  it('stays a manageable number of points', () => {
    expect(FIELD.cols * FIELD.rows).toBeLessThanOrEqual(40000);
  });
});
