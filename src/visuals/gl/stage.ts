// What every WebGL scene shares (DESIGN.md §3.5): the renderer, post-processing (bloom, then grain and
// a vignette in display colour), the background drawn exactly as --bg, centring on the chord card,
// adaptive resolution, and context loss. A scene supplies its Three.js scene, camera and a per-frame
// update.
import { Color, HalfFloatType, PerspectiveCamera, Scene as ThreeScene, Vector2, WebGLRenderer, WebGLRenderTarget } from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Scene } from '../scene';
import { glUniforms, type GlUniforms } from './uniforms';

/** Film grain and a soft vignette, applied last, in display colour (also dithers away banding). */
const GrainShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.025 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uAmount; varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= mix(0.7, 1.0, smoothstep(1.1, 0.35, length(vUv - 0.5) * 1.4));
      c.rgb += (rand(vUv * 1000.0) - 0.5) * uAmount;
      gl_FragColor = c;
    }`,
};

export interface GlSceneSpec {
  scene: ThreeScene;
  camera: PerspectiveCamera;
  bloom: { strength: number; radius: number; threshold: number };
  /** Called each frame with the shader inputs; update uniforms and transforms here. */
  update(u: GlUniforms, scene: Scene): void;
  /** Called after a resize, with the new aspect ratio (adjust the camera's field of view here). */
  onResize?(aspect: number): void;
  dispose(): void;
}

export interface GlVisuals {
  lost: boolean;
  resize(): void;
  setFocus(y: number): void;
  draw(scene: Scene | null, now: number): void;
  dispose(): void;
}

export class GlStage implements GlVisuals {
  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private grain: ShaderPass;
  private pixelRatio: number;
  private slowFrames = 0;
  private lastDraw = 0;
  private cleared = false;
  private focusY = 0.5;
  private readonly background: Color;
  lost = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    background: string,
    private readonly spec: GlSceneSpec,
  ) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.background = new Color(background);
    // No tone mapping: scenes stay dim enough not to clip, and a filmic curve would crush --bg.
    this.renderer.setClearColor(0x000000, 1);
    this.pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });
    // The background is drawn as part of the scene (converted once, at the output pass). As a clear
    // colour it was converted twice and came out grey.
    spec.scene.background = this.background;

    // Multisampled target so fine lines and points stay smooth through the effects.
    const target = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(spec.scene, spec.camera));
    const b = spec.bloom;
    this.composer.addPass(new UnrealBloomPass(new Vector2(256, 256), b.strength, b.radius, b.threshold));
    this.composer.addPass(new OutputPass());
    // Grain last, in display colour: before the output conversion it would lift the blacks to grey.
    this.grain = new ShaderPass(GrainShader);
    this.composer.addPass(this.grain);
    this.resize();
  }

  /** Where the scene's centre of interest sits on screen, as a fraction of the height (the chord card). */
  setFocus(y: number): void {
    if (Math.abs(y - this.focusY) < 0.001) return;
    this.focusY = y;
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    const cam = this.spec.camera;
    cam.aspect = w / Math.max(1, h);
    this.spec.onResize?.(cam.aspect);
    // Shift the view so the scene's centre lands on the chord card, not the middle of the screen.
    cam.setViewOffset(w, h, 0, (0.5 - this.focusY) * h, w, h);
    cam.updateProjectionMatrix();
  }

  /** The current pixel ratio (scenes that size points in pixels need it). */
  get pixels(): number {
    return this.pixelRatio;
  }

  draw(scene: Scene | null, now: number): void {
    if (this.lost) return;
    if (!scene) {
      if (!this.cleared) {
        this.renderer.setClearColor(this.background, 1); // straight to screen: one conversion, correct
        this.renderer.clear();
        this.renderer.setClearColor(0x000000, 1);
        this.cleared = true;
      }
      return;
    }
    this.cleared = false;
    this.adapt(now);
    this.spec.update(glUniforms(scene), scene);
    this.grain.uniforms.uTime!.value = (now / 1000) % 100;
    this.composer.render();
  }

  /** If frames keep running long, render at a lower resolution (down to 0.6×). */
  private adapt(now: number): void {
    const dt = this.lastDraw ? now - this.lastDraw : 16;
    this.lastDraw = now;
    if (dt > 24 && dt < 200) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 45 && this.pixelRatio > 0.6) {
      this.pixelRatio = Math.max(0.6, this.pixelRatio - 0.2);
      this.slowFrames = 0;
      this.resize();
    }
  }

  dispose(): void {
    this.composer.dispose();
    this.spec.dispose();
    this.renderer.dispose();
  }
}
