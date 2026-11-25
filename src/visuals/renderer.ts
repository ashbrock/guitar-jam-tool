// Draws the generative visuals (DESIGN.md §3) on a canvas, in the vibe's own style. It's given what's playing each frame and
// keeps its own easing state; it never touches audio, and the audio never waits for it.
import { pc } from '../theory/notes';
import type { SimpleChord } from '../theory/simplify';
import type { VibeLook } from '../theory/vibe';
import { approach, baseCycles, beatSwell, chordRatios, type Layer } from './harmony';
import type { Scene } from './scene';
import { drawStyle, resolutionFor } from './styles/index';
import type { VisualStyle } from '../theory/vibe';

export interface VisualInput {
  look: VibeLook;
  /** The chord sounding now (or the first chord when stopped). */
  chord: SimpleChord | undefined;
  /** Index of that chord in the progression; a change starts a crossfade. */
  slotIndex: number | null;
  phase: 'stopped' | 'count-in' | 'playing' | 'paused';
  /** 0–1 through the current beat, from the audio clock. */
  beatFraction: number;
  /** Beats from the start of the loop (bar × 4 + beat + fraction), from the audio clock. */
  beatPosition: number;
  tempo: number;
  reducedMotion: boolean;
}

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// Rates from DESIGN.md §3.3 (per second).
const FADE_IN = 2.2;
const FADE_OUT = 3;
const CROSSFADE = 3.5;
const COLOUR = 2.5;
const BASE = 1.5;

export class Visuals {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private layers: Layer[] = [{ ratios: [1, 5 / 4, 3 / 2], w: 1, target: 1 }];
  private colA: number[] = [0, 0, 0];
  private colB: number[] = [0, 0, 0];
  private base = 1.4;
  private baseTarget = 1.4;
  private presence = 0;
  private swell = 0;
  private phase = 0;
  private lastSlot: number | null = -2;
  private lastTime = 0;
  private coloured = false;
  private changeAge = 10;
  private beatPos = 0;
  private style: VisualStyle | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly background: string,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.resize();
  }

  /** Match the canvas to its CSS size, at the resolution the current style wants. */
  resize(): void {
    const dpr = this.style ? resolutionFor(this.style, window.devicePixelRatio) : Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Draws one frame. `now` is a performance.now() timestamp in ms. */
  render(now: number, f: VisualInput): void {
    const dt = this.lastTime ? Math.min(0.1, (now - this.lastTime) / 1000) : 0;
    this.lastTime = now;
    const playing = f.phase === 'playing';
    const paused = f.phase === 'paused';
    const still = f.reducedMotion;
    const look = f.look;
    if (look.style !== this.style) {
      this.style = look.style;
      this.resize();
    }

    // Paused: everything holds exactly where it was (DESIGN.md §3.3).
    const fdt = paused ? 0 : dt;

    // A chord change adds a layer that fades in while the others fade out.
    if (playing && f.slotIndex !== this.lastSlot) {
      this.lastSlot = f.slotIndex;
      for (const l of this.layers) l.target = 0;
      this.layers.push({ ratios: chordRatios(f.chord), w: still ? 1 : 0, target: 1 });
      this.baseTarget = baseCycles(look.cycles, f.chord ? pc(f.chord.chord.root) : 0);
      this.changeAge = 0;
    }
    this.changeAge += fdt;
    if (playing) this.beatPos = f.beatPosition;
    if (!playing && !paused) this.lastSlot = -2;
    for (const l of this.layers) l.w = still ? l.target : approach(l.w, l.target, fdt, CROSSFADE);
    this.layers = this.layers.filter((l) => l.target > 0 || l.w > 0.002);
    this.base = still ? this.baseTarget : approach(this.base, this.baseTarget, fdt, BASE);

    const minorish = f.chord && (f.chord.kind === 'minor' || f.chord.kind === 'dim');
    const [ta, tb] = minorish ? look.minor : look.major;
    const A = hex(ta);
    const B = hex(tb);
    if (!this.coloured || still) {
      this.colA = A;
      this.colB = B;
      this.coloured = true;
    } else {
      this.colA = this.colA.map((c, i) => approach(c, A[i]!, fdt, COLOUR));
      this.colB = this.colB.map((c, i) => approach(c, B[i]!, fdt, COLOUR));
    }

    // Shown while playing or paused; hidden before the first play.
    const shown = playing || paused;
    this.presence = approach(this.presence, shown ? 1 : 0, dt, shown ? FADE_IN : FADE_OUT);
    if (!still && playing) this.phase += dt * (f.tempo / 90) * 2.2 * look.speed * (0.3 + 0.7 * this.presence);
    if (still) this.swell = 0;
    else if (playing) this.swell = beatSwell(f.beatFraction);

    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.w, this.h);
    if (this.presence > 0.003) {
      const scene: Scene = {
        w: this.w,
        h: this.h,
        look,
        layers: this.layers,
        base: this.base,
        t: this.phase + look.sway * Math.sin(this.phase * 1.7) * 0.6,
        swell: this.swell,
        presence: this.presence,
        colA: this.colA,
        colB: this.colB,
        changeAge: still ? 10 : this.changeAge,
        beatPos: still ? 0 : this.beatPos,
      };
      ctx.save();
      drawStyle(look.style, ctx, scene, this.background);
      ctx.restore();
    }
  }
}
