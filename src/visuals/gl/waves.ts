// "Particle waves" (every vibe, DESIGN.md §3.5): a field of particles seen from above, filling the
// screen, flowing freely. Each chord tone sends its own waves across it at its own ratio, so the chord
// is a moving interference pattern: consonant chords roll calmly, tense ones chop. A chord change sends
// a ring outward from under the chord card, like a drop in water; bass raises the swell, treble adds
// shimmer, the beat breathes it. The vibe's palette washes across it (warmer for major chords, cooler
// for minor); crests catch the light and troughs fall into shadow. The vibe's look sets its feel:
// wave height, flow and sway.
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PerspectiveCamera,
  Points,
  Scene as ThreeScene,
  ShaderMaterial,
  Vector4,
} from 'three';
import { GlStage, type GlVisuals } from './stage';

/** The field: columns and rows of particles, and its size in world units (x across, z down the screen). */
export const FIELD = { cols: 300, rows: 220, width: 240, depth: 190, near: 65 } as const;

/** Where ripples start: the point on the field under the chord card (what the camera looks at). */
export const CENTRE = { x: 0, z: -12 } as const;

/** A stable pseudo-random 0–1 for an integer. */
export function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Particle positions: a grid with each particle nudged off it by a fixed pseudo-random amount (so the
 * field never reads as rows), plus a per-particle seed (in y) that the shader uses to vary its flow.
 */
export function fieldPositions(cols: number = FIELD.cols, rows: number = FIELD.rows): Float32Array {
  const out = new Float32Array(cols * rows * 3);
  const cw = FIELD.width / (cols - 1);
  const rh = FIELD.depth / (rows - 1);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      out[k++] = (c / (cols - 1) - 0.5) * FIELD.width + (hash(i * 2) - 0.5) * cw * 0.9;
      out[k++] = hash(i * 2 + 1); // seed, 0–1
      out[k++] = FIELD.near - (r / (rows - 1)) * FIELD.depth + (hash(i * 3 + 7) - 0.5) * rh * 0.9;
    }
  }
  return out;
}

const VERT = /* glsl */ `
uniform float uTime, uSwell, uBass, uTreble, uPulse, uAge, uMix, uBase, uPixel, uAmp, uFlow;
uniform vec4 uRatios, uPrev, uVoices;
uniform vec2 uCentre;
varying float vLight;
varying float vTint;

// One set of waves per chord tone, each travelling its own way at its tone's ratio.
float chordWaves(vec2 p, vec4 ratios) {
  float s = 0.0, w = 0.0;
  for (int i = 0; i < 4; i++) {
    float r = ratios[i];
    float wt = uVoices[i] / (1.0 + float(i) * 0.5);
    float a = float(i) * 1.3 + 0.4;
    vec2 dir = vec2(cos(a), sin(a));
    s += wt * sin(dot(p, dir) * 0.075 * r * uBase + uTime * r * 0.9 + float(i) * 1.7);
    w += wt;
  }
  return s / max(w, 0.001);
}

void main() {
  float seed = position.y;
  vec2 p = position.xz;
  // Free flow: each particle drifts along a slow, curling current, so the field moves like streams
  // rather than a grid.
  p += vec2(
    sin(p.y * 0.045 + uTime * 0.35 + seed * 6.283),
    cos(p.x * 0.04 - uTime * 0.3 + seed * 4.0)
  ) * (2.0 + 5.0 * uFlow);

  float h = mix(chordWaves(p, uPrev), chordWaves(p, uRatios), uMix) * uAmp * (1.0 + uBass * 2.2 + uSwell * 5.0);
  // Treble: a fine shimmer on the surface.
  h += sin(p.x * 0.9 + uTime * 3.1) * sin(p.y * 0.7 - uTime * 2.3) * uTreble * 0.9;
  // A chord change: a ring travelling outward from under the chord card, like a drop in water.
  float ring = length(p - uCentre) - uAge * 34.0;
  h += uPulse * 3.0 * exp(-ring * ring / 30.0);

  vec4 mv = modelViewMatrix * vec4(p.x, h, p.y, 1.0);
  float dist = -mv.z;
  // Crests swell in size as well as brightness, so the wave shapes read from above.
  gl_PointSize = uPixel * min(3.6, (1.3 + max(h, 0.0) * 0.35) * (85.0 / dist));
  // Crests catch the light, troughs fall into shadow.
  vLight = 0.2 + 0.8 * smoothstep(-3.0, 4.0, h);
  // The palette washes slowly across the field, and crests lean to the second colour.
  vTint = clamp(0.5 + 0.35 * sin(p.x * 0.018 + p.y * 0.013 + uTime * 0.15) + 0.25 * (h / 4.0), 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform float uPresence;
uniform vec3 uColA, uColB;
varying float vLight;
varying float vTint;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  vec3 col = mix(uColA, uColB, vTint);
  gl_FragColor = vec4(col * (0.85 * vLight * a * uPresence), 1.0);
}
`;

export function createWaves(canvas: HTMLCanvasElement, background: string): GlVisuals {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(fieldPositions(), 3));
  const material = new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uSwell: { value: 0 },
      uBass: { value: 0 },
      uTreble: { value: 0 },
      uPulse: { value: 0 },
      uAge: { value: 10 },
      uMix: { value: 1 },
      uBase: { value: 1.4 },
      uPixel: { value: 1 },
      uAmp: { value: 2.4 },
      uFlow: { value: 0.3 },
      uPresence: { value: 0 },
      uCentre: { value: { x: CENTRE.x, y: CENTRE.z } },
      uColA: { value: new Color() },
      uColB: { value: new Color() },
      uRatios: { value: new Vector4(1, 1.25, 1.5, 1) },
      uPrev: { value: new Vector4(1, 1.25, 1.5, 1) },
      uVoices: { value: new Vector4(1, 1, 1, 0) },
    },
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false; // positions are set in the shader
  const scene = new ThreeScene();
  scene.add(points);

  // Looking down at about 50°: steep enough that the field fills the screen with no horizon, shallow
  // enough to keep a sense of depth and swell.
  const camera = new PerspectiveCamera(50, 1, 0.1, 400);
  const aim = () => {
    camera.position.set(0, 48, CENTRE.z + 40);
    camera.lookAt(CENTRE.x, 0, CENTRE.z);
  };
  aim();

  let stage: GlStage | null = null;
  stage = new GlStage(canvas, background, {
    scene,
    camera,
    bloom: { strength: 0.6, radius: 0.35, threshold: 0.18 },
    onResize: (aspect) => {
      // Tall phones see less width, so widen the view a little.
      camera.fov = aspect < 0.75 ? 62 : 50;
      aim();
    },
    update: (u, s) => {
      const m = material.uniforms;
      m.uTime!.value = u.time;
      m.uSwell!.value = u.swell;
      m.uBass!.value = u.bass;
      m.uTreble!.value = u.treble;
      m.uPulse!.value = u.pulse;
      m.uAge!.value = u.changeAge;
      m.uMix!.value = u.mix;
      m.uBase!.value = u.base;
      m.uPresence!.value = u.presence;
      m.uPixel!.value = stage?.pixels ?? 1;
      // The vibe's feel: wave height from its amplitude, flow from its sway.
      m.uAmp!.value = 1.2 + s.look.amp * 0.8;
      m.uFlow!.value = s.look.sway;
      // Palette: sRGB in, linear for the GPU (converted back at the output pass).
      (m.uColA!.value as Color).setRGB(...u.colA, 'srgb');
      (m.uColB!.value as Color).setRGB(...u.colB, 'srgb');
      (m.uRatios!.value as Vector4).set(...u.ratios);
      (m.uPrev!.value as Vector4).set(...u.prevRatios);
      (m.uVoices!.value as Vector4).set(...u.voices);
      // A slow sway of the whole field, tied to the music's drift time (still when paused).
      points.rotation.y = Math.sin(u.time * 0.05) * 0.18;
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
  return stage;
}
