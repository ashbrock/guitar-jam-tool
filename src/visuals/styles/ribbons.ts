// Neo-soul, "velvet ribbons": one soft ribbon per chord tone, drifting lazily across the screen.
// A 7th chord grows a fourth ribbon; it fades in and out with the chord crossfade.
import { field, wave } from '../harmony';
import { mix, voiceWeight, type Scene } from '../scene';

/** Up to four ribbons; ribbon i is as present as the chords that have an (i+1)th tone. */
export function ribbonAlphas(layers: Scene['layers']): number[] {
  return [1, 2, 3, 4].map((n) => voiceWeight(layers, n));
}

/** Vertical centre of ribbon i of 4, spread around the middle of the screen (0–1). */
export function ribbonCentre(i: number): number {
  return 0.5 + (i - 1.5) * 0.11;
}

export function drawRibbons(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { w: W, h: H, look } = s;
  const alphas = ribbonAlphas(s.layers);
  const newest = s.layers[s.layers.length - 1];
  const ratios = newest?.ratios ?? [1, 5 / 4, 3 / 2];
  const step = 8;
  const amp = (H / 9) * look.amp * 0.5 * (1 + s.swell);
  // Lazy, behind-the-beat sway: the ribbons lag a slow oscillation.
  const lag = Math.sin(s.t * 0.35) * look.sway;
  for (let i = 0; i < 4; i++) {
    const a = alphas[i]!;
    if (a < 0.01) continue;
    const r = ratios[Math.min(i, ratios.length - 1)]!;
    const cy = H * ribbonCentre(i);
    const top: number[] = [];
    const bot: number[] = [];
    for (let x = 0; x <= W + step; x += step) {
      const u = x / W;
      const mid = cy + field(s.layers, s.base, u + lag * 0.05, i, s.t * 0.8) * amp;
      // Thickness breathes along the ribbon with its own harmonic.
      const thick = look.width * 6 * (0.6 + 0.4 * wave([r], s.base * 0.7, u, i * 2, s.t * 0.6)) * (1 + s.swell);
      top.push(mid - thick);
      bot.push(mid + thick);
    }
    // A wide, faint glow behind the ribbon.
    const glow = ctx.createLinearGradient(0, 0, W, 0);
    glow.addColorStop(0, mix(s.colA, s.colB, i / 3, 0.08 * a * s.presence));
    glow.addColorStop(1, mix(s.colB, s.colA, i / 3, 0.08 * a * s.presence));
    ctx.fillStyle = glow;
    ctx.beginPath();
    top.forEach((y, k) => (k ? ctx.lineTo(k * step, y - (bot[k]! - y)) : ctx.moveTo(0, y - (bot[0]! - y))));
    for (let k = bot.length - 1; k >= 0; k--) ctx.lineTo(k * step, bot[k]! + (bot[k]! - top[k]!));
    ctx.closePath();
    ctx.fill();
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, mix(s.colA, s.colB, i / 3, 0.38 * a * s.presence));
    grad.addColorStop(1, mix(s.colB, s.colA, i / 3, 0.38 * a * s.presence));
    ctx.fillStyle = grad;
    ctx.beginPath();
    top.forEach((y, k) => (k ? ctx.lineTo(k * step, y) : ctx.moveTo(0, y)));
    for (let k = bot.length - 1; k >= 0; k--) ctx.lineTo(k * step, bot[k]!);
    ctx.closePath();
    ctx.fill();
    // A bright thread along the ribbon's upper edge.
    ctx.strokeStyle = mix(s.colA, s.colB, 0.5, 0.8 * a * s.presence);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    top.forEach((y, k) => (k ? ctx.lineTo(k * step, y) : ctx.moveTo(0, y)));
    ctx.stroke();
  }
}
