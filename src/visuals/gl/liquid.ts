// "Liquid light" (Neo-soul pilot, DESIGN.md §3.5): glowing streams of light, one per chord tone, flowing
// through a slowly warping liquid field, with bloom, film grain and a vignette. Three.js; loaded only
// when first needed (see ../index.ts).
import {
  ACESFilmicToneMapping,
  Color,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene as ThreeScene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderer,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Scene } from '../scene';
import { liquidUniforms } from './uniforms';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime, uSwell, uPresence, uBase, uMix, uPulse, uAspect;
uniform vec3 uColA, uColB;
uniform vec4 uRatios, uPrev, uVoices;

// Smooth value noise and fbm: cheap, and soft enough for liquid.
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
  return v;
}

void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float t = uTime * 0.35;

  // The liquid: a domain-warped field that slowly folds the space the light flows through.
  vec2 q = vec2(fbm(p * 1.4 + vec2(0.0, t * 0.12)), fbm(p * 1.4 + vec2(5.2, 1.3) - t * 0.1));
  vec2 r = p + 0.38 * (q - 0.5);
  float liquid = fbm(r * 2.2 + q * 1.5 + t * 0.05);

  vec3 col = vec3(0.0);
  // Ambient glow in the liquid itself, kept low so the streams lead.
  col += mix(uColA, uColB, liquid) * 0.018 * smoothstep(0.45, 0.85, liquid);

  // One stream of light per chord tone. Each follows its tone's ratio, so the harmony shapes the flow;
  // a crossfade blends the previous chord's shape into the new one.
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float ratio = mix(uPrev[i], uRatios[i], uMix);
    float lane = (fi - 1.5) * 0.12;
    float y = lane
      + 0.11 * sin(r.x * uBase * ratio * 3.1 + t * ratio * 1.3 + fi * 1.7)
      + 0.05 * sin(r.x * uBase * ratio * 7.3 - t * 0.9 + fi);
    float d = abs(r.y - y);
    float width = 0.0045 + 0.003 * sin(r.x * 4.0 + t + fi) + 0.004 * uSwell * 8.0;
    float core = exp(-d * d / (width * width));
    // A tight halo that falls away fast, so the background stays dark between streams.
    float h = 0.01 / (d + 0.01);
    float halo = h * h;
    vec3 tone = mix(uColA, uColB, clamp(fi / 3.0 + 0.35 * (q.x - 0.5), 0.0, 1.0));
    col += uVoices[i] * tone * (core * 1.4 + halo * 0.18) * (0.8 + 0.5 * uPulse * exp(-abs(r.x) * 1.5));
  }

  // Fade towards the screen edges so the light pools in the middle, behind the chord.
  col *= smoothstep(1.25, 0.2, length(p * vec2(0.8, 1.2)));
  gl_FragColor = vec4(col * uPresence, 1.0);
}
`;

/** Film grain and a soft vignette, after bloom (also dithers away gradient banding). */
const GrainShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAmount: { value: 0.035 } },
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uTime, uAmount; varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float v = smoothstep(1.1, 0.35, length(vUv - 0.5) * 1.4);
      c.rgb *= mix(0.75, 1.0, v);
      c.rgb += (rand(vUv * 1000.0) - 0.5) * uAmount;
      gl_FragColor = c;
    }`,
};

export class LiquidVisuals {
  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private material: ShaderMaterial;
  private bloom: UnrealBloomPass;
  private grain: ShaderPass;
  private pixelRatio: number;
  private slowFrames = 0;
  private lastDraw = 0;
  private cleared = false;
  private readonly colA = new Color();
  private readonly colB = new Color();
  lost = false;

  constructor(private readonly canvas: HTMLCanvasElement, background: string) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setClearColor(new Color(background), 1);
    // Filmic tone mapping: bright cores roll off softly instead of clipping to flat colour.
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    // Render below device resolution and let bloom and grain hide it; drops further if a device struggles.
    this.pixelRatio = Math.min(1.25, window.devicePixelRatio || 1);
    this.renderer.setPixelRatio(this.pixelRatio);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });

    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uSwell: { value: 0 },
        uPresence: { value: 0 },
        uBase: { value: 1.4 },
        uMix: { value: 1 },
        uPulse: { value: 0 },
        uAspect: { value: 1 },
        uColA: { value: new Color() },
        uColB: { value: new Color() },
        uRatios: { value: new Vector4(1, 1.25, 1.5, 1) },
        uPrev: { value: new Vector4(1, 1.25, 1.5, 1) },
        uVoices: { value: new Vector4(1, 1, 1, 0) },
      },
    });
    const scene = new ThreeScene();
    scene.add(new Mesh(new PlaneGeometry(2, 2), this.material));
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.75, 0.45, 0.32);
    this.composer.addPass(this.bloom);
    this.grain = new ShaderPass(GrainShader);
    this.composer.addPass(this.grain);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.material.uniforms.uAspect!.value = w / Math.max(1, h);
  }

  /** Draws one frame, or clears once when there's nothing to show. */
  draw(scene: Scene | null, now: number): void {
    if (this.lost) return;
    if (!scene) {
      if (!this.cleared) {
        this.renderer.clear();
        this.cleared = true;
      }
      return;
    }
    this.cleared = false;
    this.adapt(now);
    const u = liquidUniforms(scene);
    const m = this.material.uniforms;
    m.uTime!.value = u.time;
    m.uSwell!.value = u.swell;
    m.uPresence!.value = u.presence;
    m.uBase!.value = u.base;
    m.uMix!.value = u.mix;
    m.uPulse!.value = u.pulse;
    (m.uRatios!.value as Vector4).set(...u.ratios);
    (m.uPrev!.value as Vector4).set(...u.prevRatios);
    (m.uVoices!.value as Vector4).set(...u.voices);
    // Our colours are sRGB; Three works in linear and converts back at the output pass.
    (m.uColA!.value as Color).copy(this.colA.setRGB(...u.colA, 'srgb'));
    (m.uColB!.value as Color).copy(this.colB.setRGB(...u.colB, 'srgb'));
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
    this.material.dispose();
    this.renderer.dispose();
  }
}
