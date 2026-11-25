// "Orb" (Neo-soul pilot, DESIGN.md §3.5): a glowing wireframe sphere between two rippling wireframe
// terrains, slowly turning. Starting point: Santosh Arron's audio-visualizer-three-js (MIT, 2021),
// rebuilt for current Three.js with the deformation on the GPU, and driven by both the audio and the
// harmony: the chord's ratios shape the sphere's surface, bass and treble push it, a chord change
// swells it, the beat breathes it. Loaded only when first needed (see ../index.ts).
import {
  AdditiveBlending,
  Color,
  Group,
  HalfFloatType,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
  PlaneGeometry,
  Scene as ThreeScene,
  ShaderMaterial,
  Vector2,
  Vector4,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { Scene } from '../scene';
import { glUniforms } from './uniforms';

/** 3D simplex noise: Ashima Arts / Ian McEwan & Stefan Gustavson (MIT), the standard GLSL port. */
const SIMPLEX = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const ORB_VERT = /* glsl */ `
${SIMPLEX}
uniform float uTime, uBass, uTreble, uSwell, uPulse, uMix, uRadius;
uniform vec4 uRatios, uPrev, uVoices;
varying float vDisp;
varying float vDepth;

// The chord as a surface: one noise field per chord tone, at that tone's ratio, weighted by how present
// the tone is. Consonant chords give broad, calm swells; tense ones get busier.
float chordField(vec3 n, vec4 ratios) {
  float s = 0.0, w = 0.0;
  for (int i = 0; i < 4; i++) {
    float r = ratios[i];
    float wt = uVoices[i] / (1.0 + float(i) * 0.5);
    s += wt * snoise(n * (0.9 * r) + vec3(uTime * 0.22 * r, uTime * 0.17, -uTime * 0.13 * r));
    w += wt;
  }
  return s / max(w, 0.001);
}

void main() {
  vec3 n = normalize(position);
  float h = mix(chordField(n, uPrev), chordField(n, uRatios), uMix);
  float fine = snoise(n * 3.4 + uTime * 0.5);
  float disp = h * (1.4 + uBass * 7.0 + uSwell * 9.0) + fine * uTreble * 2.4 + uPulse * 1.6;
  vec4 mv = modelViewMatrix * vec4(n * (uRadius + disp), 1.0);
  vDisp = disp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const ORB_FRAG = /* glsl */ `
uniform vec3 uColA, uColB;
uniform float uPresence, uNear, uFar;
varying float vDisp;
varying float vDepth;
void main() {
  // Peaks lean to the second colour and glow brighter; the far side of the sphere is dimmer.
  float k = smoothstep(-3.0, 6.0, vDisp);
  vec3 col = mix(uColA, uColB, k) * (0.55 + 0.8 * smoothstep(0.0, 7.0, vDisp));
  float front = mix(0.3, 1.0, smoothstep(uFar, uNear, vDepth));
  gl_FragColor = vec4(col * front * uPresence * 0.38, 1.0);
}
`;

const PLANE_VERT = /* glsl */ `
${SIMPLEX}
uniform float uTime, uLevel, uSwell;
varying float vFade;
varying float vH;
void main() {
  vec3 p = position;
  float h = snoise(vec3(p.xy * 0.012, uTime * 0.12)) * (1.5 + uLevel * 11.0 + uSwell * 8.0);
  p.z += h;
  vH = h;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  // Fade with distance from the camera, so lines don't pile up into a glare at the horizon.
  vFade = 1.0 - smoothstep(70.0, 240.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const PLANE_FRAG = /* glsl */ `
uniform vec3 uColA, uColB;
uniform float uPresence;
varying float vFade;
varying float vH;
void main() {
  vec3 col = mix(uColA, uColB, smoothstep(-4.0, 6.0, vH));
  gl_FragColor = vec4(col * vFade * vFade * 0.13 * uPresence, 1.0);
}
`;

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

const RADIUS = 18;
const CAMERA_Z = 100;

const glow = { transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, wireframe: true } as const;

export class OrbVisuals {
  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private camera: PerspectiveCamera;
  private group = new Group();
  private orb: ShaderMaterial;
  private top: ShaderMaterial;
  private bottom: ShaderMaterial;
  private grain: ShaderPass;
  private pixelRatio: number;
  private slowFrames = 0;
  private lastDraw = 0;
  private cleared = false;
  private readonly colA = new Color();
  private readonly colB = new Color();
  private readonly background: Color;
  lost = false;

  constructor(private readonly canvas: HTMLCanvasElement, background: string) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.background = new Color(background);
    this.renderer.setClearColor(0x000000, 1);
    // No tone mapping: the lines are kept dim enough not to clip, and a filmic curve would crush the
    // near-black background below --bg.
    this.pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });

    const shared = () => ({
      uTime: { value: 0 },
      uSwell: { value: 0 },
      uPresence: { value: 0 },
      uColA: { value: new Color() },
      uColB: { value: new Color() },
    });
    this.orb = new ShaderMaterial({
      ...glow,
      vertexShader: ORB_VERT,
      fragmentShader: ORB_FRAG,
      uniforms: {
        ...shared(),
        uBass: { value: 0 },
        uTreble: { value: 0 },
        uPulse: { value: 0 },
        uMix: { value: 1 },
        uRadius: { value: RADIUS },
        uNear: { value: CAMERA_Z - RADIUS },
        uFar: { value: CAMERA_Z + RADIUS },
        uRatios: { value: new Vector4(1, 1.25, 1.5, 1) },
        uPrev: { value: new Vector4(1, 1.25, 1.5, 1) },
        uVoices: { value: new Vector4(1, 1, 1, 0) },
      },
    });
    this.group.add(new Mesh(new IcosahedronGeometry(RADIUS, 4), this.orb));

    const plane = () => new ShaderMaterial({ ...glow, vertexShader: PLANE_VERT, fragmentShader: PLANE_FRAG, uniforms: { ...shared(), uLevel: { value: 0 } } });
    this.top = plane();
    this.bottom = plane();
    const terrain = new PlaneGeometry(520, 520, 36, 36);
    const top = new Mesh(terrain, this.top);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 34;
    const bottom = new Mesh(terrain, this.bottom);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = -34;
    this.group.add(top, bottom);

    const scene = new ThreeScene();
    // The background is drawn as part of the scene (converted to display colour once, at the output
    // pass). As a clear colour it was converted twice and came out grey.
    scene.background = new Color(background);
    scene.add(this.group);
    this.camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 0, CAMERA_Z);
    this.camera.lookAt(0, 0, 0);

    // Multisampled target so the thin wireframe lines stay smooth through the effects.
    const target = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.55, 0.2, 0.25));
    this.composer.addPass(new OutputPass());
    // Grain last, in display colour: added before the output conversion it would lift the blacks to grey.
    this.grain = new ShaderPass(GrainShader);
    this.composer.addPass(this.grain);
    this.resize();
  }

  resize(): void {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio);
    this.composer.setSize(w, h);
    this.camera.aspect = w / Math.max(1, h);
    // Keep the sphere a similar size on wide screens and tall phones.
    this.camera.fov = this.camera.aspect < 0.75 ? 52 : 45;
    this.camera.updateProjectionMatrix();
  }

  /** Draws one frame, or clears once when there's nothing to show. */
  draw(scene: Scene | null, now: number): void {
    if (this.lost) return;
    if (!scene) {
      if (!this.cleared) {
        this.renderer.setClearColor(this.background, 1); // straight to screen: one conversion, correct
        this.renderer.clear();
        this.cleared = true;
      }
      return;
    }
    this.cleared = false;
    this.adapt(now);
    const u = glUniforms(scene);
    // Our colours are sRGB; Three works in linear and converts back at the output pass.
    this.colA.setRGB(...u.colA, 'srgb');
    this.colB.setRGB(...u.colB, 'srgb');
    for (const m of [this.orb, this.top, this.bottom]) {
      m.uniforms.uTime!.value = u.time;
      m.uniforms.uSwell!.value = u.swell;
      m.uniforms.uPresence!.value = u.presence;
      (m.uniforms.uColA!.value as Color).copy(this.colA);
      (m.uniforms.uColB!.value as Color).copy(this.colB);
    }
    const o = this.orb.uniforms;
    o.uBass!.value = u.bass;
    o.uTreble!.value = u.treble;
    o.uPulse!.value = u.pulse;
    o.uMix!.value = u.mix;
    (o.uRatios!.value as Vector4).set(...u.ratios);
    (o.uPrev!.value as Vector4).set(...u.prevRatios);
    (o.uVoices!.value as Vector4).set(...u.voices);
    // As in the original: treble ripples the ceiling, bass the floor.
    this.top.uniforms.uLevel!.value = u.treble;
    this.bottom.uniforms.uLevel!.value = u.bass;
    // A slow turn, tied to the music's drift time (so it stops when paused).
    this.group.rotation.y = u.time * 0.12;
    this.group.rotation.x = Math.sin(u.time * 0.05) * 0.08;
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
    this.orb.dispose();
    this.top.dispose();
    this.bottom.dispose();
    this.renderer.dispose();
  }
}
