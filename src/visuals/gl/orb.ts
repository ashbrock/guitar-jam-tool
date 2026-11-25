// "Orb" (Neo-soul pilot, DESIGN.md §3.5): a lit, greyscale sphere: a dark solid shell under a glowing
// wireframe, deformed by the music and centred on the current chord card. Starting point: Santosh
// Arron's audio-visualizer-three-js (MIT, 2021), rebuilt for current Three.js with the deformation and
// lighting on the GPU, and driven by both the audio and the harmony: the chord's tones shape the
// surface, bass and treble push it, a chord change swells it, the beat breathes it. Loaded only when
// first needed (see ../index.ts).
import {
  AdditiveBlending,
  Color,
  Group,
  HalfFloatType,
  IcosahedronGeometry,
  Mesh,
  PerspectiveCamera,
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

/**
 * The deformed surface, shared by the shell and the wireframe: where a point on the unit sphere ends
 * up, and the lit normal there (from the surface itself, so every bump the music pushes out catches
 * the light).
 */
const SURFACE = /* glsl */ `
${SIMPLEX}
uniform float uTime, uBass, uTreble, uSwell, uPulse, uMix, uRadius, uScale;
uniform vec4 uRatios, uPrev, uVoices;

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

vec3 surface(vec3 n) {
  float h = mix(chordField(n, uPrev), chordField(n, uRatios), uMix);
  float fine = snoise(n * 3.4 + uTime * 0.5);
  float disp = h * (1.4 + uBass * 7.0 + uSwell * 9.0) + fine * uTreble * 2.4 + uPulse * 1.6;
  return n * (uRadius + disp) * uScale;
}

// Normal of the deformed surface, from two nearby points along the sphere's tangents.
vec3 surfaceNormal(vec3 n, vec3 p) {
  vec3 t1 = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 t2 = cross(n, t1);
  float e = 0.03;
  vec3 a = surface(normalize(n + t1 * e)) - p;
  vec3 b = surface(normalize(n + t2 * e)) - p;
  vec3 nn = normalize(cross(a, b));
  return dot(nn, n) < 0.0 ? -nn : nn;
}
`;

const VERT = /* glsl */ `
${SURFACE}
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec3 n = normalize(position);
  vec3 p = surface(n);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vNormal = normalize(normalMatrix * surfaceNormal(n, p));
  vView = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;

/** Lighting, in view space so the light stays put while the orb turns: a soft key from the upper left, a rim. */
const LIGHT = /* glsl */ `
uniform float uPresence;
varying vec3 vNormal;
varying vec3 vView;
const vec3 KEY = normalize(vec3(-0.55, 0.65, 0.55));
float diffuse() { return max(dot(normalize(vNormal), KEY), 0.0); }
float rim() { return pow(1.0 - max(dot(normalize(vNormal), vView), 0.0), 3.0); }
float spec() { return pow(max(dot(normalize(vNormal), normalize(KEY + vView)), 0.0), 40.0); }
`;

/** The shell: a dark, matte-to-satin surface that gives the orb its body, light side and shadow side. */
const SHELL_FRAG = /* glsl */ `
${LIGHT}
void main() {
  float l = 0.008 + 0.16 * diffuse() + 0.3 * spec() + 0.03 * rim();
  gl_FragColor = vec4(vec3(l) * uPresence, 1.0);
}
`;

/** The wireframe on top: lines glow on the lit side and fade into the shadow side. */
const WIRE_FRAG = /* glsl */ `
${LIGHT}
void main() {
  float l = 0.025 + 0.7 * diffuse() + 0.3 * spec() + 0.12 * rim();
  gl_FragColor = vec4(vec3(l) * uPresence, 1.0);
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

const RADIUS = 21;
const CAMERA_Z = 100;

export class OrbVisuals {
  private renderer: WebGLRenderer;
  private composer: EffectComposer;
  private camera: PerspectiveCamera;
  private group = new Group();
  private shell: ShaderMaterial;
  private wire: ShaderMaterial;
  private grain: ShaderPass;
  private pixelRatio: number;
  private slowFrames = 0;
  private lastDraw = 0;
  private cleared = false;
  private focusY = 0.5;
  private readonly background: Color;
  lost = false;

  constructor(private readonly canvas: HTMLCanvasElement, background: string) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.background = new Color(background);
    // No tone mapping: the orb is kept dim enough not to clip, and a filmic curve would crush the
    // near-black background below --bg.
    this.renderer.setClearColor(0x000000, 1);
    this.pixelRatio = Math.min(1.5, window.devicePixelRatio || 1);
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lost = true;
    });

    const uniforms = (scale: number) => ({
      uTime: { value: 0 },
      uSwell: { value: 0 },
      uPresence: { value: 0 },
      uBass: { value: 0 },
      uTreble: { value: 0 },
      uPulse: { value: 0 },
      uMix: { value: 1 },
      uRadius: { value: RADIUS },
      uScale: { value: scale },
      uRatios: { value: new Vector4(1, 1.25, 1.5, 1) },
      uPrev: { value: new Vector4(1, 1.25, 1.5, 1) },
      uVoices: { value: new Vector4(1, 1, 1, 0) },
    });
    // The shell writes depth (so lines on the far side are hidden) and sits just inside the wireframe.
    this.shell = new ShaderMaterial({ vertexShader: VERT, fragmentShader: SHELL_FRAG, uniforms: uniforms(0.985) });
    this.wire = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: WIRE_FRAG,
      uniforms: uniforms(1),
      wireframe: true,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const shell = new Mesh(new IcosahedronGeometry(1, 6), this.shell);
    const wire = new Mesh(new IcosahedronGeometry(1, 4), this.wire);
    wire.renderOrder = 1;
    this.group.add(shell, wire);

    const scene = new ThreeScene();
    // The background is drawn as part of the scene (converted to display colour once, at the output
    // pass). As a clear colour it was converted twice and came out grey.
    scene.background = this.background;
    scene.add(this.group);
    this.camera = new PerspectiveCamera(45, 1, 0.1, 1000);
    this.camera.position.set(0, 0, CAMERA_Z);
    this.camera.lookAt(0, 0, 0);

    // Multisampled target so the thin wireframe lines stay smooth through the effects.
    const target = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
    this.composer = new EffectComposer(this.renderer, target);
    this.composer.addPass(new RenderPass(scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new Vector2(256, 256), 0.42, 0.22, 0.32));
    this.composer.addPass(new OutputPass());
    // Grain last, in display colour: added before the output conversion it would lift the blacks to grey.
    this.grain = new ShaderPass(GrainShader);
    this.composer.addPass(this.grain);
    this.resize();
  }

  /** Where the orb's centre sits on screen, as a fraction of the height (the centre of the chord card). */
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
    this.camera.aspect = w / Math.max(1, h);
    // Keep the sphere a similar size on wide screens and tall phones.
    this.camera.fov = this.camera.aspect < 0.75 ? 52 : 45;
    // Shift the view so the orb's centre lands on the chord card, not the middle of the screen.
    this.camera.setViewOffset(w, h, 0, (0.5 - this.focusY) * h, w, h);
    this.camera.updateProjectionMatrix();
  }

  /** Draws one frame, or clears once when there's nothing to show. */
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
    const u = glUniforms(scene);
    for (const m of [this.shell, this.wire]) {
      const v = m.uniforms;
      v.uTime!.value = u.time;
      v.uSwell!.value = u.swell;
      v.uPresence!.value = u.presence;
      v.uBass!.value = u.bass;
      v.uTreble!.value = u.treble;
      v.uPulse!.value = u.pulse;
      v.uMix!.value = u.mix;
      (v.uRatios!.value as Vector4).set(...u.ratios);
      (v.uPrev!.value as Vector4).set(...u.prevRatios);
      (v.uVoices!.value as Vector4).set(...u.voices);
    }
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
    this.shell.dispose();
    this.wire.dispose();
    this.renderer.dispose();
  }
}
