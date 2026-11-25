// Blues, "smoke": blue haze curling upward, like a club under stage lights. A few soft plumes rise
// and widen; overlapping translucent fills make the haze. The chord shapes the curl; dominant 7ths add
// a restless (smooth, never flashing) waver at the edges; the shuffle sways the plumes.
import { field } from '../harmony';
import { mix, ratioWeight, type Scene } from '../scene';

/** How far smoke has spread at a height (0 = bottom, 1 = top): it widens as it rises. */
export function smokeSpread(rise: number): number {
  const r = Math.max(0, Math.min(1, rise));
  return 0.25 + 0.75 * r * r;
}

/** How restless the edges are: the weight of a dominant (harmonic) 7th in the sounding chord. */
export function restlessness(layers: Scene['layers']): number {
  return ratioWeight(layers, 7 / 4);
}

/** Number of plumes for a look (its `lines` is the density across the screen). */
export function plumeCount(lines: number): number {
  return Math.max(4, Math.round(lines / 2));
}

export function drawSmoke(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { w: W, h: H, look } = s;
  const n = plumeCount(look.lines);
  const step = 16;
  const spacing = W / n;
  const amp = spacing * look.amp * 0.8 * (1 + s.swell);
  const restless = restlessness(s.layers);
  const sway = Math.sin(s.t * 0.9) * look.sway; // the shuffle's lilt
  for (let i = 0; i < n; i++) {
    const x0 = spacing * (i + 0.5);
    const left: number[] = [];
    const right: number[] = [];
    const core: number[] = [];
    for (let y = H + step; y >= -step; y -= step) {
      const rise = 1 - y / H;
      const spread = smokeSpread(rise);
      const c = x0 + field(s.layers, s.base, rise - s.t * 0.12, i, s.t * 0.5) * amp * spread + sway * rise * spacing;
      const half = spacing * (0.12 + 0.55 * spread) * (1 + s.swell);
      const waver = restless * Math.sin(rise * 30 + s.t * 5 + i) * 4 * rise;
      left.push(c - half + waver);
      right.push(c + half - waver);
      core.push(c);
    }
    const ys = left.map((_, k) => H + step - k * step);
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    grad.addColorStop(0, mix(s.colA, s.colB, 0, 0.2 * s.presence));
    grad.addColorStop(0.55, mix(s.colA, s.colB, 0.6, 0.12 * s.presence));
    grad.addColorStop(1, mix(s.colA, s.colB, 1, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    left.forEach((x, k) => (k ? ctx.lineTo(x, ys[k]!) : ctx.moveTo(x, ys[k]!)));
    for (let k = right.length - 1; k >= 0; k--) ctx.lineTo(right[k]!, ys[k]!);
    ctx.closePath();
    ctx.fill();
    // A thin brighter wisp through the middle of each plume.
    const wisp = ctx.createLinearGradient(0, H, 0, 0);
    wisp.addColorStop(0, mix(s.colA, s.colB, 0.2, 0.55 * s.presence));
    wisp.addColorStop(1, mix(s.colA, s.colB, 1, 0));
    ctx.strokeStyle = wisp;
    ctx.lineWidth = look.width * 0.5;
    ctx.beginPath();
    core.forEach((x, k) => (k ? ctx.lineTo(x, ys[k]!) : ctx.moveTo(x, ys[k]!)));
    ctx.stroke();
  }
}
