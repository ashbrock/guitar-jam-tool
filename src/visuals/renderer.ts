// Draws a Scene with the 2D canvas styles (DESIGN.md §3.2). Also the fallback wherever WebGL isn't
// available or a vibe has no WebGL scene.
import type { VisualStyle } from '../theory/vibe';
import type { Scene } from './scene';
import { drawStyle, resolutionFor } from './styles/index';

export class Canvas2DVisuals {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private style: VisualStyle | null = null;
  private blank = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly background: string,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas not available');
    this.ctx = ctx;
    this.resize();
  }

  get size(): { w: number; h: number } {
    return { w: this.w, h: this.h };
  }

  /** Match the canvas to its CSS size, at the resolution the current style wants. */
  resize(): void {
    const dpr = this.style ? resolutionFor(this.style, window.devicePixelRatio) : Math.min(2, window.devicePixelRatio || 1);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.blank = false;
  }

  /** Draws one frame (or clears to the background when there's nothing to show). */
  draw(scene: Scene | null): void {
    if (scene && scene.look.style !== this.style) {
      this.style = scene.look.style;
      this.resize();
    }
    if (!scene && this.blank) return; // nothing changed: skip clearing again
    const ctx = this.ctx;
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.background;
    ctx.fillRect(0, 0, this.w, this.h);
    this.blank = !scene;
    if (!scene) return;
    ctx.save();
    drawStyle(scene.look.style, ctx, scene, this.background);
    ctx.restore();
  }
}
