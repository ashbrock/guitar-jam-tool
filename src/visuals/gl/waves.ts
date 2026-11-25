// "Particle waves" (Neo-soul, DESIGN.md §3.5): a sea of points receding to a horizon behind the chord
// card. Each chord tone sends its own waves across it at its own ratio, so the chord is a moving
// interference pattern: consonant chords roll calmly, tense ones chop. A chord change sends a ring
// outward like a drop in water; bass raises the swell, treble adds shimmer, the beat breathes it.
// Greyscale: crests catch the light, troughs fall into shadow, the far field fades into the dark.
import { AdditiveBlending, BufferAttribute, BufferGeometry, PerspectiveCamera, Points, Scene as ThreeScene, ShaderMaterial, Vector4 } from 'three';
import { GlStage, type GlVisuals } from './stage';

/** The field: columns across, rows into the distance, and its size in world units. */
export const FIELD = { cols: 220, rows: 140, width: 220, depth: 150, near: 30 } as const;

/** Grid positions for the field (x across, z into the distance; y is set in the shader). */
export function fieldPositions(cols: number = FIELD.cols, rows: number = FIELD.rows): Float32Array {
  const out = new Float32Array(cols * rows * 3);
  let k = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out[k++] = (c / (cols - 1) - 0.5) * FIELD.width;
      out[k++] = 0;
      out[k++] = FIELD.near - (r / (rows - 1)) * FIELD.depth;
    }
  }
  return out;
}

const VERT = /* glsl */ `
uniform float uTime, uSwell, uBass, uTreble, uPulse, uAge, uMix, uBase, uPixel;
uniform vec4 uRatios, uPrev, uVoices;
varying float vLight;
varying float vFade;

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
  vec2 p = position.xz;
  float h = mix(chordWaves(p, uPrev), chordWaves(p, uRatios), uMix) * (2.4 + uBass * 5.0 + uSwell * 12.0);
  // Treble: a fine shimmer on the surface.
  h += sin(p.x * 0.9 + uTime * 3.1) * sin(p.y * 0.7 - uTime * 2.3) * uTreble * 0.9;
  // A chord change: a ring travelling outward from just behind the card, like a drop in water.
  float d = length(p - vec2(0.0, -20.0));
  float ring = d - uAge * 34.0;
  h += uPulse * 3.0 * exp(-ring * ring / 30.0);

  vec4 mv = modelViewMatrix * vec4(p.x, h, p.y, 1.0);
  float dist = -mv.z;
  // Size by distance, capped so the nearest rows don't turn into a grid of big dots.
  gl_PointSize = uPixel * min(3.2, (1.3 + max(h, 0.0) * 0.22) * (70.0 / dist));
  // Crests catch the light, troughs fall into shadow; the far field fades into the dark.
  vLight = 0.18 + 0.82 * smoothstep(-3.0, 4.5, h);
  vFade = smoothstep(175.0, 55.0, dist) * smoothstep(10.0, 34.0, dist);
  gl_Position = projectionMatrix * mv;
}
`;

const FRAG = /* glsl */ `
uniform float uPresence;
varying float vLight;
varying float vFade;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, d);
  gl_FragColor = vec4(vec3(0.62 * vLight * vFade * a * uPresence), 1.0);
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
      uPresence: { value: 0 },
      uRatios: { value: new Vector4(1, 1.25, 1.5, 1) },
      uPrev: { value: new Vector4(1, 1.25, 1.5, 1) },
      uVoices: { value: new Vector4(1, 1, 1, 0) },
    },
  });
  const points = new Points(geometry, material);
  points.frustumCulled = false; // heights are set in the shader
  const scene = new ThreeScene();
  scene.add(points);

  // Low over the water, looking out to the horizon, which sits behind the chord card.
  const camera = new PerspectiveCamera(50, 1, 0.1, 400);
  camera.position.set(0, 13, 42);
  camera.lookAt(0, 0, -30);

  let stage: GlStage | null = null;
  stage = new GlStage(canvas, background, {
    scene,
    camera,
    bloom: { strength: 0.6, radius: 0.35, threshold: 0.18 },
    onResize: (aspect) => {
      // Tall phones see less width, so widen the view a little.
      camera.fov = aspect < 0.75 ? 62 : 50;
      // On tall phones, look a little lower so the wave fills more of the screen behind the card.
      camera.position.y = aspect < 0.75 ? 16 : 13;
      camera.lookAt(0, 0, -30);
    },
    update: (u) => {
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
      (m.uRatios!.value as Vector4).set(...u.ratios);
      (m.uPrev!.value as Vector4).set(...u.prevRatios);
      (m.uVoices!.value as Vector4).set(...u.voices);
    },
    dispose: () => {
      geometry.dispose();
      material.dispose();
    },
  });
  return stage;
}
