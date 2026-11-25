// Heartland, "open road": lines rush toward you from a horizon under a sky gradient. The road moves
// in eighth notes, locked to the audio clock; the chord colours the sky and shapes the horizon.
import { field } from '../harmony';
import { mix, type Scene } from '../scene';

/** Horizon height as a fraction of the screen. */
export const HORIZON = 0.42;

/**
 * Screen y (0–1) of a road line at depth z (1 = horizon … large = at your feet), by perspective.
 * Monotonic: nearer lines sit lower.
 */
export function roadY(depth: number): number {
  const d = Math.max(0, Math.min(1, depth));
  return HORIZON + (1 - HORIZON) * d * d;
}

/** Depth (0–1) of line k of n, travelling toward the viewer one line per eighth note. */
export function lineDepth(k: number, n: number, beatPos: number): number {
  const travel = (beatPos * 2) % 1; // eighth notes
  return (k + travel) / n;
}

export function drawRoad(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { w: W, h: H, look } = s;
  const hy = H * HORIZON;
  // Sky: a low, wide glow over the horizon (kept dim so text stays readable).
  const sky = ctx.createLinearGradient(0, hy - H * 0.35, 0, hy);
  sky.addColorStop(0, mix(s.colB, s.colA, 0, 0));
  sky.addColorStop(1, mix(s.colB, s.colA, 1, 0.28 * s.presence));
  ctx.fillStyle = sky;
  ctx.fillRect(0, hy - H * 0.35, W, H * 0.35);

  // Horizon: the chord's wave as a distant ridge.
  const step = 8;
  const amp = H * 0.03 * look.amp * (1 + s.swell);
  ctx.lineWidth = look.width;
  ctx.strokeStyle = mix(s.colA, s.colB, 0.5, 0.9 * s.presence);
  ctx.beginPath();
  for (let x = 0; x <= W + step; x += step) {
    const y = hy - Math.abs(field(s.layers, s.base, x / W, 0, s.t * 0.4)) * amp;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Lanes: converge on the vanishing point.
  const lanes = 9;
  for (let i = 0; i <= lanes; i++) {
    const bx = (i / lanes) * W * 2.2 - W * 0.6;
    ctx.strokeStyle = mix(s.colA, s.colB, i / lanes, 0.22 * s.presence);
    ctx.beginPath();
    ctx.moveTo(W / 2, hy);
    ctx.lineTo(bx, H);
    ctx.stroke();
  }

  // Cross lines: rushing toward you on the eighth notes, rippled by the chord.
  const n = look.lines;
  for (let k = 0; k < n; k++) {
    const depth = lineDepth(k, n, s.beatPos);
    const y0 = H * roadY(depth);
    ctx.strokeStyle = mix(s.colA, s.colB, depth, (0.15 + 0.7 * depth) * s.presence);
    ctx.lineWidth = look.width * (0.4 + depth * 1.4);
    ctx.beginPath();
    for (let x = 0; x <= W + step; x += step) {
      const y = y0 + field(s.layers, s.base, x / W, k, s.t) * amp * depth * 1.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
