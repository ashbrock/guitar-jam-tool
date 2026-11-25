import { describe, expect, it } from 'vitest';
import { FIELD, fieldPositions, hash } from './waves';

describe('particle wave field', () => {
  it('spans the field, nudged off the grid by less than a cell, with a 0–1 seed per particle', () => {
    const cols = 10, rows = 6;
    const p = fieldPositions(cols, rows);
    expect(p).toHaveLength(cols * rows * 3);
    const cw = FIELD.width / (cols - 1), rh = FIELD.depth / (rows - 1);
    for (let r = 0, k = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++, k += 3) {
        expect(Math.abs(p[k]! - (c / (cols - 1) - 0.5) * FIELD.width)).toBeLessThan(cw * 0.5);
        expect(p[k + 1]!).toBeGreaterThanOrEqual(0);
        expect(p[k + 1]!).toBeLessThan(1);
        expect(Math.abs(p[k + 2]! - (FIELD.near - (r / (rows - 1)) * FIELD.depth))).toBeLessThan(rh * 0.5);
      }
    }
  });

  it('is the same every time (stable seeds)', () => {
    expect(fieldPositions(8, 4)).toEqual(fieldPositions(8, 4));
    expect(hash(42)).toBe(hash(42));
  });

  it('stays a manageable number of points', () => {
    expect(FIELD.cols * FIELD.rows).toBeLessThanOrEqual(70000);
  });
});
