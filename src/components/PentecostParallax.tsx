import { useEffect, useRef } from "react";
import * as THREE from "three";

import { readyOnce } from "@/components/parallaxLoading";
import { assetUrl } from "@/lib/assetBase";
import { bindFlames, parseCuts, rectToUv, reliefUniforms, segmentsFor, type Cut, type UvRect } from "./parallaxRelief";

/**
 * Doré's "The Descent of the Holy Spirit" cut into ~28 depth layers and
 * reassembled in three.js. Scroll drives a camera that visits one waypoint per
 * <section data-screen-label> on the page.
 *
 * Assets expected in /public/dore/:
 *   plate.jpg            the engraving (2048x2519)
 *   plate-backdrop.png   the plate with every cutout inpainted back in
 *   cuts.json            [{ name, z, isFlame, relief?, parent? }] — a flame's
 *                        parent is the head it hangs over; it rests just in
 *                        front of that cut, on its plane (see bindFlames)
 *   cut-<name>.png       one greyscale mask per cut
 *   depth.png            baked depth of the plate (white = near), drives the
 *                        per-figure relief displacement
 *
 * The masks are a partition of unity — they sum to 1 at every pixel — so the
 * layers reassemble the plate exactly, which is why the cuts leave no seams.
 */

type Layer = {
  name: string;
  z: number;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  isFlame: number;
  relief: number;
  i: number;
  fit?: number;
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
};

export type PentecostParallaxProps = {
  /** how far apart the cut planes sit; 1 = as authored */
  layerSpread?: number;
  /** depth of the per-figure relief in world units; 0 = flat cards as before */
  figureRelief?: number;
  /** intensity of the light beam and the dove's halo */
  beamGlow?: number;
  /** flame flicker */
  flameDrift?: boolean;
  /** slow autonomous drift when the page is idle */
  idleDrift?: boolean;
  /** how far the camera pushes in across the page (0–0.5) */
  dollyIntensity?: number;
  /** every texture (and cuts.json) has arrived; fires once */
  onReady?: () => void;
  className?: string;
};

// the displacement below is transcribed from displaceLocal() in
// parallaxRelief.ts, where the projection-invariance test pins the algebra
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
uniform sampler2D map, mask;
uniform vec4 uMapRect;
uniform float uTime, uBeam, uBeamMax, uFlameDrift, uIsFlame, uFlat;
varying vec2 vUv;
void main(){
  vec2 uv = vUv;
  float edge = smoothstep(-0.004, 0.010, uv.x) * smoothstep(1.004, 0.990, uv.x)
             * smoothstep(-0.004, 0.010, uv.y) * smoothstep(1.004, 0.990, uv.y);
  // cuts fade to nothing outside the image; the backdrop clamps instead, so
  // looking past the plate shows wall rather than a void
  float m = mix(texture2D(mask, uv).r * edge, 1.0, uFlat);
  // a cut's own color map may cover only its mapRect of the plate (the mask
  // is zero outside it, so nothing samples past the texture)
  vec3 col = texture2D(map, (uv - uMapRect.xy) / uMapRect.zw).rgb;

  float lum = dot(col, vec3(0.333));
  float flick = 0.65 + 0.35 * sin(uTime * 2.7 + uv.x * 26.0);
  col += uIsFlame * uFlameDrift * pow(max(lum - 0.46, 0.0), 1.4) * 4.2 * flick * vec3(1.0, 0.84, 0.58);

  // clamp before pow(): outside the plate 1.0 - uv.y goes negative, and pow()
  // with a negative base is undefined in GLSL — it returns NaN and blackens
  // everything above the image
  vec2 cv = clamp(uv, 0.0, 1.0);
  float spread = mix(0.055, 0.34, pow(1.0 - cv.y, 1.5));
  float bx = (cv.x - 0.5) / spread;
  float beam = exp(-bx * bx * 1.9) * smoothstep(0.26, 0.96, cv.y);
  float dv = distance(cv * vec2(1.0, 1.22), vec2(0.5, 0.965 * 1.22));
  float halo = exp(-dv * dv * 180.0);
  col += (beam * 0.30 + halo * 0.34) * uBeam * uBeamMax * vec3(0.98, 0.90, 0.72);

  col = col / (1.0 + col * 0.30);
  col = pow(col, vec3(1.12)) * vec3(1.05, 1.0, 0.92);
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
  { band: [0.26, 0.84], u: 0.0 },   // hero — the whole gathering
  { band: [0.30, 0.74], u: -0.05 }, // about — a step toward the left of the ring
  { band: [0.28, 0.64], u: 0.05 },  // gatherings — heads and tongues of flame
  { band: [0.30, 0.58], u: 0.0 },   // community — centre, under the beam
  { band: [-0.02, 0.20], u: 0.0, aim: "dove", at: 0.6 }, // give — the dove
];

// lateral camera travel is what shears the figures apart and exposes the bare
// wall behind them — the drama comes from the dolly instead, so cap it hard
const LATERAL_MAX = 0.06;

const BASE = assetUrl("dore");
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
  flameDrift = true,
  idleDrift = false,
  dollyIntensity = 0.46,
  onReady,
  className,
}: PentecostParallaxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);
  // live props, so tweaking them never rebuilds the scene
  const opts = useRef({ layerSpread, figureRelief, beamGlow, flameDrift, idleDrift, dollyIntensity });
  useEffect(() => {
    opts.current = { layerSpread, figureRelief, beamGlow, flameDrift, idleDrift, dollyIntensity };
  }, [layerSpread, figureRelief, beamGlow, flameDrift, idleDrift, dollyIntensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x14100e, 1);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

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
    const plate = sharpen(loader.load(`${BASE}/plate.jpg`), true);
    const backdrop = sharpen(loader.load(`${BASE}/plate-backdrop.png`), true);
    // no sharpen(): the vertex fetch samples lod 0, so mipmaps would never be read
    const depthMap = loader.load(`${BASE}/depth.png`);
    depthMap.generateMipmaps = false;
    depthMap.minFilter = THREE.LinearFilter;
    depthMap.magFilter = THREE.LinearFilter;

    let baseZ = 20;
    const cutMaps: THREE.Texture[] = [];
    let layers: Layer[] = [];
    let backdropLayer: Layer | null = null;
    let doveLayer: Layer | undefined;
    let raf = 0;
    let disposed = false;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let sections: HTMLElement[] = [];

    const resize = () => {
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
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
    ) =>
      new THREE.ShaderMaterial({
        uniforms: {
          map: { value: map },
          mask: { value: mask },
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

    /** where we are in the section stack: an index plus the fraction through it */
    const sectionProgress = () => {
      if (!sections.length) return 0;
      const y = document.documentElement.scrollTop + window.innerHeight * 0.5;
      for (let i = 0; i < sections.length; i++) {
        const el = sections[i];
        if (y < el.offsetTop + el.offsetHeight || i === sections.length - 1) {
          const t = Math.min(1, Math.max(0, (y - el.offsetTop) / el.offsetHeight));
          return Math.min(sections.length - 1, i + t);
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
      scene.add(bgMesh);
      backdropLayer = { name: "backdrop", z: BACKDROP_Z, mesh: bgMesh, mat: bgMat, isFlame: 0, relief: 0, i: -1, fit: FIT_BG };

      // a flame at parent.z + FLAME_LIFT sorts right after its parent, so it
      // draws over the head it rests on and nothing else
      layers = bindFlames(cuts)
        .sort((a, b) => a.z - b.z)
        .map((cut, i) => {
          const mask = sharpen(loader.load(`${BASE}/cut-${cut.name}.png`));
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
          const mat = material(map, mask, cut.isFlame, 0, depth, rectToUv(cut.mapRect));
          mat.name = cut.name;
          // each plane is scaled so every cut registers at the opening framing
          const mesh = new THREE.Mesh(geom(cut.z, FIT, segmentsFor(cut.relief)), mat);
          mesh.name = `cut-${cut.name}`;
          mesh.position.z = cut.z;
          mesh.renderOrder = i + 1;
          scene.add(mesh);
          return { name: cut.name, z: cut.z, mesh, mat, isFlame: cut.isFlame, relief: cut.relief, i };
        });
      doveLayer = layers.find((l) => l.name === "dove");

      const t0 = performance.now();
      // the camera chases its target through this state, so scroll jumps
      // (snap, fast flicks) arrive as a glide instead of a lurch
      const cam = { x: 0, y: 0, z: 0, init: false };
      let lastT = 0;
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const o = opts.current;
        const t = (performance.now() - t0) / 1000;
        const spread = Math.min(1.6, Math.max(0.2, o.layerSpread));
        const de = document.documentElement;
        const span = de.scrollHeight - de.clientHeight;
        const p = span > 0 ? Math.min(1, Math.max(0, de.scrollTop / span)) : 0;
        const ease = p * p * (3 - 2 * p);

        const idle = o.idleDrift ? 1 : 0;
        const dx = Math.sin(t * 0.17) * 0.18 * idle;
        const dy = Math.cos(t * 0.13) * 0.11 * idle;
        pointer.x += (pointer.tx - pointer.x) * 0.045;
        pointer.y += (pointer.ty - pointer.y) * 0.045;

        const sp = sectionProgress();
        const i0 = Math.min(WAYPOINTS.length - 1, Math.floor(sp));
        const i1 = Math.min(WAYPOINTS.length - 1, i0 + 1);
        // hold each section's own frame, then travel in its second half —
        // otherwise a section spends its whole length en route to the NEXT
        // waypoint
        const ft = sp - i0;
        const th = Math.min(1, Math.max(0, (ft - 0.5) / 0.5));
        const fe = th * th * (3 - 2 * th);

        const tanA = Math.tan(((camera.fov * Math.PI) / 180) / 2);
        // the distance that makes the band fill the frame vertically — note it
        // never involves aspect, which is the whole point
        const solve = (wp: Waypoint) => {
          const z = Math.max(baseZ * 0.12, Math.min(baseZ, ((wp.band[1] - wp.band[0]) / 2) * IH / tanA));
          const hh = z * tanA;
          let y: number;
          if (wp.aim === "dove" && doveLayer) {
            // a far layer's apparent height is not the plate's, so the dove has
            // to be solved against where its own plane actually is
            const zL = doveLayer.mesh.position.z;
            const yL = (0.5 - DOVE_V) * IH * ((baseZ - zL) / baseZ);
            y = yL - (2 * (wp.at ?? 0.6) - 1) * hh / (z / (z - zL));
          } else {
            y = (0.5 - (wp.band[0] + wp.band[1]) / 2) * IH;
          }
          return { y, z, x: (wp.u ?? 0) * IW };
        };
        const wa = solve(WAYPOINTS[i0]);
        const wb = solve(WAYPOINTS[i1]);
        const zc = wa.z + (wb.z - wa.z) * fe;
        const halfH = zc * tanA;
        const limY = Math.max(0, IH * 0.9 - halfH);
        const limX = Math.min(Math.max(0, IW / 2 - halfH * camera.aspect), IW * LATERAL_MAX);
        const xWant = wa.x + (wb.x - wa.x) * fe + pointer.x * -0.10 + dx;
        const yWant = wa.y + (wb.y - wa.y) * fe + pointer.y * -0.18 + dy;
        const tx = Math.max(-limX, Math.min(limX, xWant));
        const ty = Math.max(-limY, Math.min(limY, yWant));
        // critically-damped chase: framerate-independent, no overshoot
        const dt = Math.min(0.05, t - lastT);
        lastT = t;
        const k = 1 - Math.exp(-dt * 4.2);
        if (!cam.init) {
          cam.x = tx; cam.y = ty; cam.z = zc; cam.init = true;
        }
        cam.x += (tx - cam.x) * k;
        cam.y += (ty - cam.y) * k;
        cam.z += (zc - cam.z) * k;
        camera.position.set(cam.x, cam.y, cam.z);
        camera.lookAt(cam.x, cam.y, 0);

        const all = backdropLayer ? [backdropLayer, ...layers] : layers;
        const beam = 0.3 + Math.pow(sp / (WAYPOINTS.length - 1), 1.15) * 0.95;
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
          l.mat.uniforms.uRelief.value = l.relief * o.figureRelief;
          l.mat.uniforms.uCamZ.value = ru.uCamZ;
          l.mat.uniforms.uLayerZ.value = ru.uLayerZ;
          l.mat.uniforms.uScale.value = ru.uScale;
          // every flame rests on its head (bindFlames); the ascent toward the
          // dove is issue #35 — a flamePose(index, progress, t) would set
          // position from that rest pose here
        }
        renderer.render(scene, camera);
      };
      tick();
    };

    const onResize = () => {
      resize();
      const all = backdropLayer ? [backdropLayer, ...layers] : layers;
      for (const l of all) {
        l.mesh.geometry.dispose();
        l.mesh.geometry = geom(l.z, l.fit ?? FIT, segmentsFor(l.relief));
      }
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

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("deviceorientation", onTilt);
      for (const l of backdropLayer ? [backdropLayer, ...layers] : layers) {
        l.mesh.geometry.dispose();
        l.mat.dispose();
      }
      for (const t of cutMaps) t.dispose();
      plate.dispose();
      backdrop.dispose();
      depthMap.dispose();
      renderer.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className={className ?? "absolute inset-0 block h-full w-full"} />;
}
