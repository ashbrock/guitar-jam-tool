// Desert Groove, "dunes": stacked ridgelines like layered sand, nearer ridges taller, with a faint heat
// shimmer on the far ones. The modal vamp rocks them gently side to side.
import { field } from '../harmony';
import { mix, type Scene } from '../scene';

/** Baseline (0–1 of screen height) of ridge k of n: from the far ridge near the top to the near one at the bottom. */
export function ridgeBase(k: number, n: number): number {
  return 0.3 + 0.62 * (k / Math.max(1, n - 1));
}

/** Ridge height multiplier: far ridges are low, near ridges tall. */
export function ridgeScale(k: number, n: number): number {
  return 0.35 + 0.65 * (k / Math.max(1, n - 1));
}

export function drawDunes(ctx: CanvasRenderingContext2D, s: Scene, background: string): void {
  const { w: W, h: H, look } = s;
  const n = look.lines;
  const step = 8;
  const amp = (H / n) * look.amp * (1 + s.swell);
  const rock = Math.sin(s.t * 0.6) * look.sway * 0.08; // side to side
  ctx.lineWidth = look.width;
  for (let k = 0; k < n; k++) {
    const y0 = H * ridgeBase(k, n);
    const scale = ridgeScale(k, n);
    const far = 1 - k / Math.max(1, n - 1);
    const pts: number[] = [];
    for (let x = 0; x <= W + step; x += step) {
      const u = x / W + rock * (1 - far);
      const shimmer = far * Math.sin(u * 90 + s.t * 5 + k) * 1.2;
      pts.push(y0 - Math.abs(field(s.layers, s.base, u, k, s.t * 0.4)) * amp * scale + shimmer);
    }
    // Fill below the ridge with the background so nearer dunes hide the ones behind.
    ctx.fillStyle = background;
    ctx.beginPath();
    pts.forEach((y, i) => (i ? ctx.lineTo(i * step, y) : ctx.moveTo(0, y)));
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = mix(s.colA, s.colB, k / n, (0.35 + 0.6 * (1 - far)) * s.presence);
    ctx.beginPath();
    pts.forEach((y, i) => (i ? ctx.lineTo(i * step, y) : ctx.moveTo(0, y)));
    ctx.stroke();
  }
}
