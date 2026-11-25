// Dreamy, "aurora": soft curtains of light, very slow. Each curtain is a wavy edge with streaks of
// light hanging from it and fading out. The chord shapes the folds; the vibe's low speed blends
// changes over seconds.
import { field } from '../harmony';
import { mix, type Scene } from '../scene';

/** Number of curtains. */
export const CURTAINS = 3;

/** Opacity of curtain i at full presence: front curtains brighter, all of them soft. */
export function curtainAlpha(i: number): number {
  return 0.16 + 0.1 * (i / (CURTAINS - 1));
}

/** Length of the streak at column k (0–1 of the curtain's length): varies smoothly along the curtain. */
export function streakLength(k: number, t: number, i: number): number {
  return 0.55 + 0.25 * Math.sin(k * 0.08 + t * 0.35 + i * 2) + 0.15 * Math.sin(k * 0.023 - t * 0.2 + i);
}

/** A fixed pseudo-random 0–1 for streak k, so streaks aren't evenly spaced (stable from frame to frame). */
export function jitter(k: number): number {
  const x = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function drawAurora(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { w: W, h: H, look } = s;
  const step = 5;
  const amp = H * 0.08 * look.amp * (1 + s.swell);
  ctx.lineCap = 'round';
  for (let i = 0; i < CURTAINS; i++) {
    const topY = H * (0.14 + i * 0.1);
    const len = H * (0.4 - i * 0.06);
    const grad = ctx.createLinearGradient(0, topY - amp, 0, topY + amp + len);
    grad.addColorStop(0, mix(s.colA, s.colB, i / CURTAINS, curtainAlpha(i) * 2.2 * s.presence));
    grad.addColorStop(0.3, mix(s.colA, s.colB, (i + 1) / CURTAINS, curtainAlpha(i) * 1.2 * s.presence));
    grad.addColorStop(1, mix(s.colA, s.colB, 1, 0));
    ctx.strokeStyle = grad;
    // Three widths of streak, each its own path, with jittered positions: light, not a bar chart.
    for (let g = 0; g < 3; g++) {
      ctx.lineWidth = look.width * (1 + g * 1.4);
      ctx.globalAlpha = 1 - g * 0.25;
      ctx.beginPath();
      for (let k = g; k * step <= W + step; k += 3) {
        const x = (k + jitter(k + i * 1000) * 0.9) * step;
        const y = topY + field(s.layers, s.base * 0.6, x / W, i * 3, s.t * 0.5) * amp;
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + len * streakLength(k, s.t, i));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // The bright upper edge of the curtain.
    ctx.strokeStyle = mix(s.colA, s.colB, i / CURTAINS, curtainAlpha(i) * 2.5 * s.presence);
    ctx.lineWidth = look.width;
    ctx.beginPath();
    for (let x = 0; x <= W + step; x += step) {
      const y = topY + field(s.layers, s.base * 0.6, x / W, i * 3, s.t * 0.5) * amp;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}
