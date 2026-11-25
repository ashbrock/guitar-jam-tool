// The six visual styles, one per vibe (DESIGN.md §3.2). A vibe's look names its style.
import type { Scene } from '../scene';
import { drawAurora } from './aurora';
import { drawDunes } from './dunes';
import { drawGrooves } from './grooves';
import { drawRibbons } from './ribbons';
import { drawRoad } from './road';
import { drawSmoke } from './smoke';

import type { VisualStyle } from '../../theory/vibe';

/**
 * Hazy styles draw at 1× resolution and are scaled up by the browser: a quarter of the pixels to fill
 * on a retina phone, and the softness suits them. Crisp styles draw at device resolution (max 2×).
 */
export function resolutionFor(style: VisualStyle, devicePixelRatio: number): number {
  const crisp = Math.min(2, devicePixelRatio || 1);
  return style === 'smoke' || style === 'aurora' ? Math.min(1, crisp) : crisp;
}

export function drawStyle(style: VisualStyle, ctx: CanvasRenderingContext2D, s: Scene, background: string): void {
  switch (style) {
    case 'ribbons':
      return drawRibbons(ctx, s);
    case 'smoke':
      return drawSmoke(ctx, s);
    case 'grooves':
      return drawGrooves(ctx, s);
    case 'road':
      return drawRoad(ctx, s);
    case 'aurora':
      return drawAurora(ctx, s);
    case 'dunes':
      return drawDunes(ctx, s, background);
  }
}
