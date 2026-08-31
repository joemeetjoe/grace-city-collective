import { useEffect, useRef } from "react";
import * as THREE from "three";

import { createEmbers, emberCount, type EmberLayer } from "@/components/embers";
import {
  EMBERS_SIDE,
  assignLayer,
  canvasFor,
  stopAt,
  renderPasses,
  type CanvasSide,
  type RenderPass,
} from "@/components/layerSplit";
import { readyOnce } from "@/components/parallaxLoading";
import { glslVec3, tokens } from "@/theme/tokens";
import { createRenderGate } from "@/components/renderGate";
import { REDUCED_MOTION_QUERY } from "@/intro/introPolicy";
import { assetUrl } from "@/lib/assetBase";
import { budgetYaw, chase, orbitPose, reliefGain } from "./cameraOrbit";
import { ascentProgress, flamePose } from "./flamePose";
import { portraitFactor, widenBand } from "./portraitBand";
import { armGyroOnFirstTouch } from "@/scene/gyro";
import { TIERS, textureDir, type Tier } from "@/scene/tier";
import { getScrollTop } from "@/scroll/position";
import { bindFlames, huddleShift, parseCuts, rectToUv, reliefUniforms, segmentsFor, type Cut, type UvRect } from "./parallaxRelief";
import { RAY_NEAR_Z, createRayLayer, rayIntensity, rayRenderOrder, raySpecs, type RayLayer } from "./rayPlanes";
import { channelVector, maskRef } from "./textureManifest";
import { VIGNETTE_GLSL } from "./vignette";

/**
 * Doré's "The Descent of the Holy Spirit" cut into ~28 depth layers and
 * reassembled in three.js. Scroll drives a camera that visits one waypoint per
 * <section data-screen-label> on the page.
 *
 * Assets expected in /public/dore/<tier>/ (tools/recut/pack_textures.py):
 *   plate.webp           the engraving (2048x2519 in the desktop tier)
 *   plate-backdrop.webp  the plate with every cutout inpainted back in
 *   cuts.json            [{ name, z, isFlame, relief?, parent?, at?, mask }] — a
 *                        flame's parent is the head it hangs over; it rests
 *                        just in front of that cut, on its plane (see
 *                        bindFlames), and leaves it from `at` (see flamePose);
 *                        mask is { file, channel } into the packed textures
 *   masks-*.webp         four greyscale masks per texture, one per channel
 *   depth.webp           baked depth of the plate (white = near), drives the
 *                        per-figure relief displacement
 *
 * The masks are a partition of unity — they sum to 1 at every pixel — so the
 * layers reassemble the plate exactly, which is why the cuts leave no seams.
 *
 * Two canvases, one scene, one camera (layerSplit.ts): given a `frontCanvas`,
 * the floor, the nearest apostles on the left and the embers are drawn by a
 * second renderer to a transparent canvas that the page stacks over the
 * wordmark and the hero headline; everything else stays on this one, under
 * the page. The camera's layer mask is switched between the two passes.
 * Textures load once (they are shared THREE.Texture objects) but a context
 * can only sample what it uploaded, so the two the front figures share with
 * the back — the plate and its depth — are uploaded to both.
 */

type Layer = {
  name: string;
  z: number;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  isFlame: number;
  relief: number;
  i: number;
  /** which canvas it draws to at the current stop (layerSplit.ts) */
  side: CanvasSide;
  fit?: number;
  /** the cut's centre as plate fractions (figures and flames), and a flame's ordinal among the flames */
  at?: [number, number];
  flame?: number;
  /** a flame's parent cut, whose huddle shift it rides */
  parent?: string;
};

type Waypoint = {
  /** band of the plate this frame must contain, in image v (0 = top) */
  band: [number, number];
  /** lateral offset as a fraction of plate width */
  u?: number;
  /** aim at a named layer's live position instead of the band centre */
  aim?: "dove";
  /** where in frame the aimed layer should sit (0 = bottom, 1 = top) */
  at?: number;
  /**
   * the same on a portrait frame, where the copy sits at the foot: the dove
   * goes to the top fifth, above the panel, which also keeps the frame's top
   * at the plate's edge rather than past it (clamped rows read as a smear)
   */
  atPortrait?: number;
};

export type PentecostParallaxProps = {
  /** how far apart the cut planes sit; 1 = as authored */
  layerSpread?: number;
  /** depth of the per-figure relief in world units; 0 = flat cards as before */
  figureRelief?: number;
  /** intensity of the light rays and the dove's halo */
  beamGlow?: number;
  /** how many ray planes fan out from the dove (read once, when the scene builds) */
  rays?: number;
  /** flame flicker */
  flameDrift?: boolean;
  /** slow autonomous drift when the page is idle */
  idleDrift?: boolean;
  /** how far the camera pushes in across the page (0–0.5) */
  dollyIntensity?: number;
  /** half-swing of the pointer's orbit about the look-at point, degrees */
  orbitYaw?: number;
  /** vertical half-swing of the same orbit, degrees */
  orbitPitch?: number;
  /** figureRelief ramps to this with the pointer at either edge */
  reliefGain?: number;
  /**
   * how many embers drift in the foreground; 0 disables the layer. Default:
   * emberCount() of the viewport — none under prefers-reduced-motion
   */
  embers?: number;
  /** every texture (and cuts.json) has arrived; fires once */
  onReady?: () => void;
  /** a texture arrived: how many so far, of how many requested */
  onProgress?: (loaded: number, total: number) => void;
  /**
   * a second canvas, stacked above the page's type, for the nearest layers
   * (layerSplit.ts); without it everything draws to the one canvas
   */
  frontCanvas?: React.RefObject<HTMLCanvasElement | null>;
  /** asset tier (scene/tier.ts): picks the texture directory; read once at mount */
  tier?: Tier;
  className?: string;
};

// the displacement below is transcribed from displaceLocal() in
// parallaxRelief.ts, where the projection-invariance test pins the algebra
// the flicker highlight: the seal copper warmed toward the cream so the
// brightest pixels of a tongue read as fire, not as paint
const FLAME_GLOW_HEX = "#f2a86a";

const VERT = `
uniform float uFit;
uniform sampler2D depthMap;
uniform vec4 uMapRect;
uniform float uRelief, uCamZ, uLayerZ, uScale;
varying vec2 vUv;
void main(){
  vUv = (uv - 0.5) / uFit + 0.5;
  vec3 p = position;
  // a cut's own depth map covers only its mapRect of the plate
  vec2 duv = (vUv - uMapRect.xy) / uMapRect.zw;
  // world-space push toward the camera; 0.5 is the plate's rest plane
  float dz = (texture2D(depthMap, duv).r - 0.5) * uRelief;
  // shrink toward the axis so the displaced vertex projects exactly where the
  // flat one did from the registration camera at (0,0,uCamZ)
  p.xy *= (uCamZ - uLayerZ - dz) / (uCamZ - uLayerZ);
  // the mesh is rescaled every frame, so a world dz must be applied in local units
  p.z += dz / uScale;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = `
#define FLAME_EMBER ${glslVec3(tokens.seal)}
#define FLAME_BODY ${glslVec3(tokens.sealHighlight)}
#define FLAME_GLOW ${glslVec3(FLAME_GLOW_HEX)}
uniform sampler2D map, mask;
uniform vec4 uMapRect, uMaskChannel;
uniform float uTime, uBeam, uBeamMax, uFlameDrift, uIsFlame, uFlat, uVignette;
uniform vec2 uResolution;
varying vec2 vUv;
${VIGNETTE_GLSL}
void main(){
  vec2 uv = vUv;
  float edge = smoothstep(-0.004, 0.010, uv.x) * smoothstep(1.004, 0.990, uv.x)
             * smoothstep(-0.004, 0.010, uv.y) * smoothstep(1.004, 0.990, uv.y);
  // cuts fade to nothing outside the image; the backdrop clamps instead, so
  // looking past the plate shows wall rather than a void
  // the mask is one channel of a packed texture; uMaskChannel picks it
  float m = mix(dot(texture2D(mask, uv), uMaskChannel) * edge, 1.0, uFlat);
  // a cut's own color map may cover only its mapRect of the plate (the mask
  // is zero outside it, so nothing samples past the texture)
  vec3 col = texture2D(map, (uv - uMapRect.xy) / uMapRect.zw).rgb;

  float lum = dot(col, vec3(0.333));
  // a flame's mask carries a rim of dark wall; key it out (see flameKey())
  m *= 1.0 - uIsFlame + uIsFlame * smoothstep(0.16, 0.44, lum);
  // the tongues are recoloured on a luminance ramp in the seal's family —
  // crimson in the hollows, copper in the body, a warm glow at the tips — and
  // lifted, since the engraving draws them as mid-grey hatching
  vec3 fire = mix(FLAME_EMBER, mix(FLAME_BODY, FLAME_GLOW, smoothstep(0.45, 0.8, lum)), smoothstep(0.12, 0.45, lum))
            * (0.25 + lum * 1.5);
  col = mix(col, fire, uIsFlame);
  float flick = 0.65 + 0.35 * sin(uTime * 2.7 + uv.x * 26.0);
  col += uIsFlame * uFlameDrift * pow(max(lum - 0.46, 0.0), 1.4) * 4.2 * flick * FLAME_GLOW;

  // the light column as ILLUMINATION on every layer — the apostles' robes in
  // the beam are lit by it, which is what keeps their hatching legible at the
  // deep dolly; without it only the wall behind them is lit and they read as
  // dark bodies under bright faces. The volumetric rays are their own planes
  // (rayPlanes.ts), so this term is softer than the flat beam it replaces.
  // Measured against the plate, not the oversized plane, so it stays put;
  // clamped before pow(): a negative base is NaN in GLSL
  vec2 cv = clamp(uv, 0.0, 1.0);
  float spread = mix(0.055, 0.42, pow(1.0 - cv.y, 1.5));
  float bx = (cv.x - 0.5) / spread;
  float beam = exp(-bx * bx * 1.9) * smoothstep(-0.2, 0.85, cv.y);
  float dv = distance(cv * vec2(1.0, 1.22), vec2(0.5, 0.965 * 1.22));
  float halo = exp(-dv * dv * 180.0);
  col += (beam * 0.22 + halo * 0.34) * uBeam * uBeamMax * vec3(0.98, 0.90, 0.72);

  col = col / (1.0 + col * 0.30);
  col = pow(col, vec3(1.12)) * vec3(1.05, 1.0, 0.92);
  // the back canvas wears the vignette as a DOM gradient; a front layer has
  // only the page under it, so it takes the same ink here
  col = mix(col, uInk, vignetteAlpha(gl_FragCoord.xy, uResolution) * uVignette);
  gl_FragColor = vec4(col, m);
}`;

/**
 * One waypoint per section. Each declares the BAND of the plate it must contain
 * rather than a frame centre — the frame's half-height in image units is
 * aspect-dependent, so a centre tuned at 4:3 starves on 16:9. Solving the
 * distance from the band fills the frame identically at every aspect.
 *
 * Content sits at: flames v 0.26–0.42, faces v 0.42–0.52, robes down to v 0.78,
 * the dove at v 0.033. The band between v 0.25 and v 0.10 is bare wall — never
 * aim a waypoint there.
 */
const WAYPOINTS: Waypoint[] = [
  { band: [0.185, 0.765], u: 0.03 }, // hero — the gathering under its flames; the near hoods reach the headline's foot
  { band: [0.30, 0.74], u: -0.05 }, // who we are — a step toward the left of the ring
  { band: [0.30, 0.58], u: 0.0 },   // house churches — centre, under the beam
  { band: [0.28, 0.64], u: 0.05 },  // gatherings — heads and tongues of flame
  { band: [0.36, 0.66], u: -0.03 }, // give — close on the faces, robes below
  { band: [-0.02, 0.20], u: 0.0, aim: "dove", at: 0.7, atPortrait: 0.82 }, // visit — the dove, with the copy under it
];

// lateral camera travel is what shears the figures apart and exposes the bare
// wall behind them — the drama comes from the dolly instead, so cap it hard
const LATERAL_MAX = 0.06;
// the pointer's pan of the whole frame, world units per unit of pointer —
// the depth comes from the orbit (cameraOrbit.ts), this only adds a little
// travel where the lateral budget allows it
const POINTER_SLIDE = 0.12;
// per-frame chase factor at 60 fps, made framerate-independent by chase()
const CHASE = 0.08;

const PLATE_W = 2048;
const PLATE_H = 2519;
const IW = 16;
const IH = IW * (PLATE_H / PLATE_W);
const FIT = 0.74;
const FIT_BG = 0.28;
const BACKDROP_Z = -5.6;
const DOVE_V = 0.033;

export default function PentecostParallax({
  layerSpread = 1,
  figureRelief = 0.5,
  beamGlow = 1,
  tier = TIERS.desktop,
  // the tier's counts unless the caller pins them
  rays = tier.rays,
  flameDrift = true,
  idleDrift = false,
  dollyIntensity = 0.46,
  orbitYaw = 3.5,
  orbitPitch = 2.5,
  reliefGain: reliefMax = 0.8,
  embers,
  onReady,
  onProgress,
  frontCanvas,
  className,
}: PentecostParallaxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef(frontCanvas);
  const tierRef = useRef(tier);
  const onReadyRef = useRef(onReady);
  const onProgressRef = useRef(onProgress);
  useEffect(() => {
    onReadyRef.current = onReady;
    onProgressRef.current = onProgress;
  }, [onReady, onProgress]);
  // live props, so tweaking them never rebuilds the scene
  const opts = useRef({
    layerSpread, figureRelief, beamGlow, rays, flameDrift, idleDrift, dollyIntensity, orbitYaw, orbitPitch, reliefMax,
    embers,
  });
  useEffect(() => {
    opts.current = {
      layerSpread, figureRelief, beamGlow, rays, flameDrift, idleDrift, dollyIntensity, orbitYaw, orbitPitch, reliefMax,
      embers,
    };
  }, [layerSpread, figureRelief, beamGlow, rays, flameDrift, idleDrift, dollyIntensity, orbitYaw, orbitPitch, reliefMax, embers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const BASE = assetUrl(textureDir(tierRef.current));

    // no MSAA (#62): every layer is an alpha-blended full-coverage quad, so
    // multisampling smooths nothing and doubles framebuffer bandwidth; low-power
    // keeps dual-GPU laptops on the integrated GPU
    const glFlags = { antialias: false, powerPreference: "low-power" } as const;
    const dpr = Math.min(window.devicePixelRatio, tierRef.current.dprCap);
    const renderer = new THREE.WebGLRenderer({ canvas, ...glFlags });
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x14100e, 1);
    // the front canvas clears to nothing: only its layers land over the page
    const front = frontRef.current?.current ?? null;
    const frontRenderer = front ? new THREE.WebGLRenderer({ canvas: front, alpha: true, ...glFlags }) : null;
    frontRenderer?.setPixelRatio(dpr);
    frontRenderer?.setClearColor(0x000000, 0);
    // without a front canvas every layer draws to the one canvas
    const sideOf = (side: CanvasSide): CanvasSide => (frontRenderer ? side : "back");
    const passes: RenderPass[] = [{ side: "back", renderer }];
    if (frontRenderer) passes.push({ side: "front", renderer: frontRenderer });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    // the drawing buffer's size, for the front layers' vignette; one vector shared by every material
    const resolution = new THREE.Vector2(1, 1);

    // every load goes through one manager so the ready signal waits for all of
    // them — including the cut masks requested only after cuts.json arrives
    const manager = new THREE.LoadingManager();
    const loader = new THREE.TextureLoader(manager);
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const sharpen = (t: THREE.Texture, srgb = false) => {
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      // the plate is thousands of fine engraved lines — without mipmaps and
      // anisotropy they alias into a shimmering woven-cloth moiré
      t.generateMipmaps = true;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.anisotropy = maxAniso;
      return t;
    };
    const plate = sharpen(loader.load(`${BASE}/plate.webp`), true);
    const backdrop = sharpen(loader.load(`${BASE}/plate-backdrop.webp`), true);
    // no sharpen(): the vertex fetch samples lod 0, so mipmaps would never be read
    const depthMap = loader.load(`${BASE}/depth.webp`);
    depthMap.generateMipmaps = false;
    depthMap.minFilter = THREE.LinearFilter;
    depthMap.magFilter = THREE.LinearFilter;

    // masks come four to a texture, one per channel, so the same file backs up
    // to four materials. They must arrive unpremultiplied: an <img> upload may
    // zero the colour under a zero alpha, wiping three masks wherever the
    // fourth is empty, which only an ImageBitmap decoded without
    // premultiplication guarantees against.
    const bitmaps = new THREE.ImageBitmapLoader(manager);
    bitmaps.setOptions({ imageOrientation: "flipY", premultiplyAlpha: "none" });
    const maskTextures = new Map<string, THREE.Texture>();
    const maskTexture = (url: string) => {
      let t = maskTextures.get(url);
      if (!t) {
        t = sharpen(new THREE.Texture());
        t.flipY = false; // orientation is fixed at decode for an ImageBitmap
        maskTextures.set(url, t);
        bitmaps.load(url, (bitmap) => {
          t!.image = bitmap;
          t!.needsUpdate = true;
        });
      }
      return t;
    };

    let baseZ = 20;
    const cutMaps: THREE.Texture[] = [];
    let layers: Layer[] = [];
    let backdropLayer: Layer | null = null;
    // the stop whose front row the cuts currently wear; -1 until the first frame
    let frontStop = -1;
    let doveLayer: Layer | undefined;
    let byName = new Map<string, Layer>();
    let rayLayer: RayLayer | null = null;
    let emberLayer: EmberLayer | null = null;
    let raf = 0;
    let disposed = false;
    let gate: ReturnType<typeof createRenderGate> | null = null;
    let observer: IntersectionObserver | null = null;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let sections: HTMLElement[] = [];
    // reduced motion keeps the flames on their heads (the dolly is scroll-paced, so it stays)
    const reducedMotion = window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      frontRenderer?.setSize(w, h, false);
      renderer.getDrawingBufferSize(resolution);
      camera.aspect = w / h;
      const tan = Math.tan(((camera.fov * Math.PI) / 180) / 2);
      // cover-fit against the image extent, not the deliberately larger planes
      baseZ = 0.95 * Math.min(IH / 2 / tan, IW / 2 / (tan * camera.aspect));
      camera.updateProjectionMatrix();
    };

    const geom = (z: number, fit = FIT, seg: [number, number] = [1, 1]) => {
      const k = (baseZ - z) / baseZ;
      return new THREE.PlaneGeometry((IW / fit) * k, (IH / fit) * k, seg[0], seg[1]);
    };

    const material = (
      map: THREE.Texture,
      mask: THREE.Texture,
      isFlame: number,
      flat: number,
      depth: THREE.Texture = depthMap,
      rect: UvRect = rectToUv(undefined),
      channel = 0,
      side: CanvasSide = "back",
    ) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uVignette: { value: side === "front" ? 1 : 0 },
          uResolution: { value: resolution },
          map: { value: map },
          mask: { value: mask },
          uMaskChannel: { value: new THREE.Vector4(...channelVector(channel)) },
          depthMap: { value: depth },
          uMapRect: { value: new THREE.Vector4(...rect) },
          uRelief: { value: 0 },
          uCamZ: { value: baseZ },
          uLayerZ: { value: 0 },
          uScale: { value: 1 },
          uTime: { value: 0 },
          uBeam: { value: 0.3 },
          uBeamMax: { value: opts.current.beamGlow },
          uFlameDrift: { value: opts.current.flameDrift ? 1 : 0 },
          uIsFlame: { value: isFlame },
          uFit: { value: flat ? FIT_BG : FIT },
          uFlat: { value: flat },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: !flat,
        depthTest: false,
        depthWrite: false,
      });

    /**
     * where we are in the scene's section stack: an index plus the fraction
     * through it. Only the labelled scene sections count — the long-form
     * below them scrolls past a scene that has already come to rest. Unclamped:
     * the last section runs to `sections.length`, which is how the embers see
     * the scene slide away; the camera clamps it to the last waypoint.
     */
    const sectionProgress = () => {
      if (!sections.length) return 0;
      // the smoothed position: with ScrollSmoother the rects sit where it
      // says, not where the native scrollbar is
      const scrollY = getScrollTop();
      const y = scrollY + window.innerHeight * 0.5;
      for (let i = 0; i < sections.length; i++) {
        const el = sections[i];
        // document-relative, whatever the sections' offsetParent is
        const top = el.getBoundingClientRect().top + scrollY;
        if (y < top + el.offsetHeight || i === sections.length - 1) {
          const t = Math.min(1, Math.max(0, (y - top) / el.offsetHeight));
          return i + t;
        }
      }
      return 0;
    };

    const start = (cuts: Cut[]) => {
      if (disposed) return;
      sections = Array.from(document.querySelectorAll<HTMLElement>("section[data-screen-label]"));
      resize();

      // a complete backdrop, on a much larger plane at the same registration, so
      // a cut that moves reveals wall instead of a hole
      const bgMat = material(backdrop, backdrop, 0, 1);
      bgMat.name = "backdrop";
      const bgMesh = new THREE.Mesh(geom(BACKDROP_Z, FIT_BG), bgMat);
      bgMesh.name = "backdrop";
      bgMesh.position.z = BACKDROP_Z;
      bgMesh.renderOrder = 0;
      scene.add(assignLayer(bgMesh, "back"));
      backdropLayer = { name: "backdrop", z: BACKDROP_Z, mesh: bgMesh, mat: bgMat, isFlame: 0, relief: 0, i: -1, side: "back", fit: FIT_BG };

      // a flame at parent.z + FLAME_LIFT sorts right after its parent, so it
      // draws over the head it rests on and nothing else
      let flameOrdinal = 0;
      layers = bindFlames(cuts)
        .sort((a, b) => a.z - b.z)
        .map((cut, i) => {
          const ref = maskRef(cut, BASE);
          const mask = maskTexture(ref.url);
          // a cut with its own color map (the crowd: its plate region contains
          // the figures; a completed figure: its hidden pixels were generated)
          // samples that instead of the shared plate, over its mapRect
          const map = cut.map ? sharpen(loader.load(`${BASE}/${cut.map}`), true) : plate;
          if (cut.map) cutMaps.push(map);
          let depth = depthMap;
          if (cut.depthMap) {
            depth = loader.load(`${BASE}/${cut.depthMap}`);
            depth.generateMipmaps = false;
            depth.minFilter = THREE.LinearFilter;
            depth.magFilter = THREE.LinearFilter;
            cutMaps.push(depth);
          }
          const side = sideOf(canvasFor(cut, 0, tierRef.current.name));
          const mat = material(map, mask, cut.isFlame, 0, depth, rectToUv(cut.mapRect), ref.channel, side);
          mat.name = cut.name;
          // each plane is scaled so every cut registers at the opening framing
          const mesh = new THREE.Mesh(geom(cut.z, FIT, segmentsFor(cut.relief)), mat);
          mesh.name = `cut-${cut.name}`;
          mesh.position.z = cut.z;
          mesh.renderOrder = i + 1;
          scene.add(assignLayer(mesh, side));
          const flame = cut.isFlame ? flameOrdinal++ : undefined;
          return { name: cut.name, z: cut.z, mesh, mat, isFlame: cut.isFlame, relief: cut.relief, i, side, at: cut.at, flame, parent: cut.parent };
        });
      doveLayer = layers.find((l) => l.name === "dove");
      byName = new Map(layers.map((l) => [l.name, l]));
      // a debug build exposes the layers so a shot script can solo them
      if (import.meta.env.VITE_SCENE_DEBUG) window.__gccScene = { layers, scene, camera };

      // the light, as planes of its own between the dove and the crowd, drawn
      // right after the crowd (see RAY_NEAR_Z) and registered like the cuts
      const layerZ = layers.map((l) => l.z);
      rayLayer = createRayLayer(raySpecs(opts.current.rays), {
        geom: (z) => geom(z),
        fit: FIT,
        plate: { w: IW, h: IH },
        origin: [0.5, 1 - DOVE_V],
        renderOrder: () => rayRenderOrder(layerZ, RAY_NEAR_Z),
      });
      // the rays fan out behind the crowd (RAY_NEAR_Z), so none crosses a front figure
      for (const m of rayLayer.meshes) scene.add(assignLayer(m, "back"));
      // embers read the viewport once, at the tier's density
      const count =
        opts.current.embers ??
        emberCount({
          width: window.innerWidth,
          height: window.innerHeight,
          dpr: window.devicePixelRatio || 1,
          reducedMotion: window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false,
          tier: tierRef.current.name,
        });
      // drawn after every cut, floor included
      const emberSide = sideOf(EMBERS_SIDE);
      emberLayer = createEmbers({
        scene,
        camera,
        count,
        renderOrder: layers.length + 1,
        resolution: emberSide === "front" ? resolution : undefined,
      });
      assignLayer(emberLayer.points, emberSide);

      const t0 = performance.now();
      // the camera chases its target through this state, so scroll jumps
      // (snap, fast flicks) arrive as a glide instead of a lurch
      const cam = { x: 0, y: 0, z: 0, init: false };
      // the flames' ascent progress, chased the same way (see flamePose)
      const flock = { p: 0 };
      let lastT = 0;
      const tick = () => {
        if (!gate?.running) return;
        raf = requestAnimationFrame(tick);
        const o = opts.current;
        const t = (performance.now() - t0) / 1000;
        const spread = Math.min(1.6, Math.max(0.2, o.layerSpread));

        const spRaw = sectionProgress();
        const sp = Math.min(sections.length - 1, spRaw);
        // the dolly and the rising flames play out across the scene, not the
        // whole page — the long-form below it must not stretch them thin
        const p = sections.length > 1 ? sp / (sections.length - 1) : 0;
        const ease = p * p * (3 - 2 * p);
        const ascent = ascentProgress(sp, reducedMotion);
        // the front row turns with the frame (layerSplit.ts): a cut that changes
        // side swaps canvas and takes or drops the front vignette
        const stop = stopAt(sp);
        if (stop !== frontStop) {
          frontStop = stop;
          for (const l of layers) {
            const side = sideOf(canvasFor(l, stop, tierRef.current.name));
            if (side === l.side) continue;
            l.side = side;
            assignLayer(l.mesh, side);
            l.mat.uniforms.uVignette.value = side === "front" ? 1 : 0;
          }
        }

        const idle = o.idleDrift ? 1 : 0;
        const dx = Math.sin(t * 0.17) * 0.18 * idle;
        const dy = Math.cos(t * 0.13) * 0.11 * idle;
        // critically-damped chase: framerate-independent, no overshoot — the
        // pointer and the camera share one rate so neither lags the other
        const dt = Math.min(0.05, t - lastT);
        lastT = t;
        const k = chase(CHASE, dt);
        pointer.x += (pointer.tx - pointer.x) * k;
        pointer.y += (pointer.ty - pointer.y) * k;

        const i0 = Math.min(WAYPOINTS.length - 1, Math.floor(sp));
        const i1 = Math.min(WAYPOINTS.length - 1, i0 + 1);
        // hold each section's own frame, then travel in its second half —
        // otherwise a section spends its whole length en route to the NEXT
        // waypoint
        const ft = sp - i0;
        const th = Math.min(1, Math.max(0, (ft - 0.5) / 0.5));
        const fe = th * th * (3 - 2 * th);

        const tanA = Math.tan(((camera.fov * Math.PI) / 180) / 2);
        // a portrait frame widens every band about its centre (portraitBand.ts)
        // so the phone sees a gathering, not a slice two faces wide; a
        // landscape frame passes 1, so the desktop framing cannot move
        const pf = portraitFactor(camera.aspect);
        // the distance that makes the band fill the frame vertically — note it
        // never involves aspect, which is the whole point
        const solve = (wp: Waypoint) => {
          // the dove stop keeps its authored band on a portrait frame: it
          // already starts above the plate's top edge, and widened it would
          // look a quarter of the frame past the plate — clamped rows
          // streaking down from the top. Every other stop widens.
          const band = widenBand(wp.band, wp.aim === "dove" ? 1 : pf);
          const z = Math.max(baseZ * 0.12, Math.min(baseZ, ((band[1] - band[0]) / 2) * IH / tanA));
          const hh = z * tanA;
          let y: number;
          if (wp.aim === "dove" && doveLayer) {
            // a far layer's apparent height is not the plate's, so the dove has
            // to be solved against where its own plane actually is
            const zL = doveLayer.mesh.position.z;
            const yL = (0.5 - DOVE_V) * IH * ((baseZ - zL) / baseZ);
            const at = pf > 1 && wp.atPortrait !== undefined ? wp.atPortrait : (wp.at ?? 0.6);
            y = yL - (2 * at - 1) * hh / (z / (z - zL));
          } else {
            y = (0.5 - (band[0] + band[1]) / 2) * IH;
          }
          return { y, z, x: (wp.u ?? 0) * IW };
        };
        const wa = solve(WAYPOINTS[i0]);
        const wb = solve(WAYPOINTS[i1]);
        const zc = wa.z + (wb.z - wa.z) * fe;
        const halfH = zc * tanA;
        const limY = Math.max(0, IH * 0.9 - halfH);
        const limX = Math.min(Math.max(0, IW / 2 - halfH * camera.aspect), IW * LATERAL_MAX);
        const xWant = wa.x + (wb.x - wa.x) * fe + dx;
        const yWant = wa.y + (wb.y - wa.y) * fe + dy;
        const tx = Math.max(-limX, Math.min(limX, xWant));
        const ty = Math.max(-limY, Math.min(limY, yWant));
        if (!cam.init) {
          cam.x = tx; cam.y = ty; cam.z = zc; cam.init = true;
          flock.p = ascent;
        }
        cam.x += (tx - cam.x) * k;
        cam.y += (ty - cam.y) * k;
        cam.z += (zc - cam.z) * k;
        // the flock rides the same damping, so a snap sends it gliding with
        // the camera instead of jumping ahead of it
        flock.p += (ascent - flock.p) * k;
        // the pointer (and the gyro, which writes the same target) orbits the
        // camera about the plate-plane point it looks at, so the near figures
        // swing across the arch while the plate holds still; the slide it
        // adds on top is what the lateral budget confines, and the orbit's own
        // reach is capped against the same budget so the wall stays hidden
        const yaw = Math.min(o.orbitYaw, budgetYaw(cam.z, IW * LATERAL_MAX));
        const pose = orbitPose(cam, pointer, {
          yawDeg: yaw,
          pitchDeg: o.orbitPitch,
          slide: POINTER_SLIDE,
          limit: { x: limX, y: limY },
        });
        camera.position.set(pose.position.x, pose.position.y, pose.position.z);
        camera.lookAt(pose.target.x, pose.target.y, pose.target.z);
        const relief = reliefGain(pointer.x, o.figureRelief, o.reliefMax);

        const all = backdropLayer ? [backdropLayer, ...layers] : layers;
        const beam = rayIntensity(sp / (WAYPOINTS.length - 1));
        rayLayer?.update({ time: t, intensity: beam, glow: o.beamGlow, zScale: spread + ease * 0.35, baseZ, cam: camera.position });
        for (const l of all) {
          l.mat.uniforms.uTime.value = t;
          l.mat.uniforms.uBeam.value = beam;
          l.mat.uniforms.uBeamMax.value = o.beamGlow;
          l.mat.uniforms.uFlameDrift.value = o.flameDrift ? 1 : 0;
          // spread pushes the cuts apart; rescaling keeps their apparent size, so
          // the extra depth buys parallax rather than zoom
          const zn = l.z * (spread + ease * 0.35);
          l.mesh.position.z = zn;
          l.mesh.scale.setScalar((baseZ - zn) / (baseZ - l.z));
          // per-frame because zn moves with the scroll and baseZ with resizes
          const ru = reliefUniforms(baseZ, l.z, zn);
          l.mat.uniforms.uRelief.value = l.relief * relief;
          l.mat.uniforms.uCamZ.value = ru.uCamZ;
          l.mat.uniforms.uLayerZ.value = ru.uLayerZ;
          l.mat.uniforms.uScale.value = ru.uScale;
          // the huddle (HUDDLE): a figure slides toward the centre line by a
          // fraction of its offset from it, in the plate's units at its live
          // depth — the plate is kn = (baseZ-zn)/baseZ times its z=0 size there
          const kn = (baseZ - zn) / baseZ;
          if (l.flame === undefined) l.mesh.position.x = huddleShift(l.at) * IW * kn;
          // a flame leaves its head for the dove (flamePose). Composition: the
          // spread transform above puts its plane at zn, scaled so the cut
          // registers as at the hero; on top of that, in world space, the
          // flame's centre (`at` — an offset of (u-0.5)·IW·kn from the mesh
          // origin, the plate being kn = (baseZ-zn)/baseZ times its z=0 size
          // there) is carried to the pose. The scale is left alone on purpose:
          // a tongue shrinks with bare perspective as it sinks toward the dove,
          // which is what makes it read as receding rather than sliding.
          // At rest the tongue also wears its parent's huddle shift, so it
          // stays on the head that moved
          if (l.flame !== undefined && l.at) {
            const zd = (doveLayer?.z ?? -3) * (spread + ease * 0.35);
            const kd = (baseZ - zd) / baseZ;
            const cx = (l.at[0] - 0.5) * IW * kn;
            const cy = (0.5 - l.at[1]) * IH * kn;
            const parentAt = l.parent !== undefined ? byName.get(l.parent)?.at : undefined;
            const pose = flamePose(l.flame, flock.p, t, {
              rest: { x: cx + huddleShift(parentAt) * IW * kn, y: cy, z: zn },
              dove: { x: 0, y: (0.5 - DOVE_V) * IH * kd, z: zd },
            });
            l.mesh.position.set(pose.x - cx, pose.y - cy, pose.z);
          }
        }
        // gl_PointSize is in device pixels, which is what the canvas buffer is sized in
        emberLayer?.update({ t, progress: spRaw, sectionCount: sections.length, heightPx: canvas.height, refZ: baseZ });
        // one scene, one camera, two passes: the mask picks which canvas sees what
        renderPasses(scene, camera, passes);
      };
      // the loop runs only while the canvas is on screen: once the scene has
      // scrolled away under the long-form there is nothing to draw
      gate = createRenderGate({
        start: () => {
          // a resumed loop must not treat the pause as one giant frame
          lastT = (performance.now() - t0) / 1000;
          raf = requestAnimationFrame(tick);
        },
        stop: () => cancelAnimationFrame(raf),
      });
      if (typeof IntersectionObserver === "undefined") {
        gate.setVisible(true);
      } else {
        observer = new IntersectionObserver(([entry]) => gate?.setVisible(entry.isIntersecting));
        observer.observe(canvas);
      }
    };

    const onResize = () => {
      resize();
      const all = backdropLayer ? [backdropLayer, ...layers] : layers;
      for (const l of all) {
        l.mesh.geometry.dispose();
        l.mesh.geometry = geom(l.z, l.fit ?? FIT, segmentsFor(l.relief));
      }
      rayLayer?.resize();
    };
    const onMove = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return;
      pointer.tx = Math.max(-1, Math.min(1, e.gamma / 32));
      pointer.ty = Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 32));
    };
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("deviceorientation", onTilt);
    // iOS only delivers those events after a permission prompt raised from a touch
    const disarmGyro = armGyroOnFirstTouch(window);

    // FileLoader calls onLoad before it reports itemEnd to the manager, so the
    // cut textures requested inside start() are counted before the queue drains
    const cutsLoader = new THREE.FileLoader(manager);
    cutsLoader.setResponseType("json");
    cutsLoader.load(
      `${BASE}/cuts.json`,
      (raw) => start(parseCuts(raw)),
      undefined,
      (err) => console.error("[PentecostParallax] could not load cuts.json", err),
    );
    // once per effect run; a run torn down by StrictMode is disposed and never reports
    const reportReady = readyOnce(() => onReadyRef.current?.());
    manager.onLoad = () => {
      if (!disposed) reportReady();
    };
    manager.onProgress = (_url, loaded, total) => {
      if (!disposed) onProgressRef.current?.(loaded, total);
    };

    return () => {
      disposed = true;
      observer?.disconnect();
      gate?.dispose();
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
      disarmGyro();
      for (const l of backdropLayer ? [backdropLayer, ...layers] : layers) {
        l.mesh.geometry.dispose();
        l.mat.dispose();
      }
      rayLayer?.dispose();
      emberLayer?.dispose();
      for (const t of cutMaps) t.dispose();
      for (const t of maskTextures.values()) t.dispose();
      plate.dispose();
      backdrop.dispose();
      depthMap.dispose();
      renderer.dispose();
      frontRenderer?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className ?? "absolute inset-0 block h-full w-full"} />;
}

declare global {
  interface Window {
    __gccScene?: { layers: Layer[]; scene: THREE.Scene; camera: THREE.Camera };
  }
}
