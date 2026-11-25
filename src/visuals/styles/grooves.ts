// Soul & Roots, "record grooves": concentric rings like a turning record. The chord ripples the
// rings; each chord change sends a soft bright ring outward from the centre.
import { field } from '../harmony';
import { mix, type Scene } from '../scene';

/** Radius the change ring has travelled, in units of the ring spacing, after `age` seconds. */
export function pulseRadius(age: number, rings: number): number {
  return age * rings * 0.55;
}

/**
 * A value around a ring (u = 0–1 of the way round) that meets itself at the seam: the wave at u is
 * blended with the wave one turn back, so u = 0 and u = 1 give the same value.
 */
export function closedLoop(g: (u: number) => number, u: number): number {
  return (1 - u) * g(u) + u * g(u - 1);
}

/** Brightness boost (0–1) of ring k when the pulse is at radius p (both in ring units): a soft bump. */
export function pulseBoost(k: number, p: number): number {
  const d = k - p;
  return Math.exp(-(d * d) / 2.2);
}

export function drawGrooves(ctx: CanvasRenderingContext2D, s: Scene): void {
  const { w: W, h: H, look } = s;
  const n = look.lines;
  const cx = W / 2;
  const cy = H * 0.46;
  const maxR = Math.hypot(W, H) * 0.55;
  const spacing = maxR / n;
  const amp = spacing * look.amp * 0.6 * (1 + s.swell);
  const turn = s.t * 0.15; // the record turns slowly
  const pulse = pulseRadius(s.changeAge, n);
  const steps = 120;
  ctx.lineWidth = look.width;
  for (let k = 1; k <= n; k++) {
    const r0 = k * spacing;
    const depth = k / n;
    const boost = pulseBoost(k, pulse) * Math.max(0, 1 - s.changeAge / 3);
    ctx.strokeStyle = mix(s.colA, s.colB, depth, (0.25 + 0.45 * (1 - depth) + 0.35 * boost) * s.presence);
    ctx.beginPath();
    for (let j = 0; j <= steps; j++) {
      const th = (j / steps) * Math.PI * 2;
      const u = j / steps;
      const r = r0 + closedLoop((v) => field(s.layers, s.base * 2, v, k, s.t * 0.7), u) * amp * depth;
      const x = cx + Math.cos(th + turn) * r;
      const y = cy + Math.sin(th + turn) * r;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
  }
}
