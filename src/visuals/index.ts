// The visuals, as the UI sees them: one call per frame. Picks the renderer for the vibe: its WebGL scene
// when it has one and WebGL 2 works (Three.js is loaded the first time it's needed), otherwise the 2D
// canvas style, which is also the fallback if WebGL fails or its context is lost.
import { Canvas2DVisuals } from './renderer';
import { VisualState, type VisualInput } from './state';
import type { GlVisuals } from './gl/stage';

export type { VisualInput } from './state';

function webgl2Available(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export class Visuals {
  private state = new VisualState();
  private flat: Canvas2DVisuals;
  private gl: GlVisuals | null = null;
  private glStatus: 'idle' | 'loading' | 'ready' | 'failed';
  private showing: 'flat' | 'gl' = 'flat';

  constructor(
    private readonly flatCanvas: HTMLCanvasElement,
    private readonly glCanvas: HTMLCanvasElement,
    private readonly background: string,
  ) {
    this.flat = new Canvas2DVisuals(flatCanvas, background);
    this.glStatus = webgl2Available() ? 'idle' : 'failed';
    this.show('flat');
  }

  private focusY = 0.5;

  resize(): void {
    this.flat.resize();
    this.gl?.resize();
  }

  /** Where the centre of attention (the chord card) sits, as a fraction of the screen height. */
  setFocus(y: number): void {
    this.focusY = y;
    this.gl?.setFocus(y);
  }

  render(now: number, input: VisualInput): void {
    const { w, h } = this.flat.size;
    const scene = this.state.step(now, input, w, h);
    const wantsGl = !!input.look.gl;
    if (wantsGl && scene && this.glStatus === 'idle') void this.loadGl();
    const useGl = wantsGl && this.glStatus === 'ready' && this.gl && !this.gl.lost;
    if (useGl) {
      this.show('gl');
      this.gl!.draw(scene, now);
    } else {
      this.show('flat');
      this.flat.draw(scene);
    }
  }

  private async loadGl(): Promise<void> {
    this.glStatus = 'loading';
    try {
      const { createWaves } = await import('./gl/waves');
      this.gl = createWaves(this.glCanvas, this.background);
      this.gl.setFocus(this.focusY);
      this.glStatus = 'ready';
    } catch {
      this.glStatus = 'failed'; // stay on the 2D style
    }
  }

  private show(which: 'flat' | 'gl'): void {
    if (which === this.showing && this.flatCanvas.style.visibility) return;
    this.showing = which;
    this.flatCanvas.style.visibility = which === 'flat' ? 'visible' : 'hidden';
    this.glCanvas.style.visibility = which === 'gl' ? 'visible' : 'hidden';
  }
}
