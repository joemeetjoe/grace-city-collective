/**
 * Every tuning number of the parallax scene, in one place (#120). The
 * modules that read them — the camera solve, the tick, the layers, the
 * factory — carry the reasoning at the point of use; this table carries
 * the values. A number that belongs to one pure module and nothing else
 * (the ray fan, the ember field, the flame ring) stays with that module.
 */

/** the plate's pixel size in the desktop tier: every aspect and rect is measured against it */
export const PLATE_PX = { width: 2048, height: 2519 } as const;

/** the plate's world size at the registration camera: 16 units wide, its aspect tall */
export const PLATE = { w: 16, h: 16 * (PLATE_PX.height / PLATE_PX.width) } as const;

/** a cut's plane is oversized by 1/FIT so a moving cut never runs off its own edge */
export const FIT = 0.74;
/** the backdrop's plane, far larger, so looking past a cut shows wall rather than a void */
export const FIT_BG = 0.28;
/** where the backdrop plane sits */
export const BACKDROP_Z = -5.6;
/** the dove's centre as a plate v (0 = top) */
export const DOVE_V = 0.033;
/** the dove's rest depth when no dove cut is in the tier's set (a flame still needs somewhere to fly) */
export const DOVE_FALLBACK_Z = -3;

/** the perspective camera, and how much of the plate the registration frame covers */
export const CAMERA = { fov: 38, near: 0.1, far: 200, cover: 0.95 } as const;

/**
 * lateral camera travel is what shears the figures apart and exposes the bare
 * wall behind them — the drama comes from the dolly instead, so cap it hard
 * (a fraction of the plate's width)
 */
export const LATERAL_MAX = 0.06;
/**
 * the pointer's pan of the whole frame, world units per unit of pointer —
 * the depth comes from the orbit (cameraOrbit.ts), this only adds a little
 * travel where the lateral budget allows it
 */
export const POINTER_SLIDE = 0.12;
/** per-frame chase factor at 60 fps, made framerate-independent by chase() */
export const CHASE = 0.08;
/** the chase's dt clamp: a long gap steps once, never leaps */
export const CHASE_DT_MAX = 0.05;
/** the ember clock's dt clamp: a sleep or a paused loop never lands as a leap of drift */
export const EMBER_DT_MAX = 0.1;

/** the layer spread's clamp, and how much more the dolly adds across the scene */
export const SPREAD = { min: 0.2, max: 1.6, dolly: 0.35 } as const;

/** the frame's travel limits: the centre stays within this much of the plate's half-height, and the dolly never nearer than this fraction of baseZ */
export const FRAME = { yReach: 0.9, zMin: 0.12 } as const;

/** hold each section's own frame through this fraction of it, then travel to the next */
export const HOLD = 0.5;

/** the idle drift's slow figure-eight, world units and rad/s */
export const IDLE_DRIFT = { x: { amp: 0.18, rate: 0.17 }, y: { amp: 0.11, rate: 0.13 } } as const;

/** converged within a subpixel: the next frames are the pacer's to skip */
export const SETTLE_EPS = { camera: 4e-4, flock: 1e-4 } as const;
/** the pointer target still this far from the pointer counts as motion */
export const POINTER_EPS = 1e-3;

/** the gyro's mapping to the pointer's −1..1: degrees per full swing, and the phone's resting pitch */
export const GYRO = { gammaSpan: 32, betaRest: 45, betaSpan: 32 } as const;

/** the page's y the section progress is read at: this far down the viewport */
export const SCROLL_PROBE = 0.5;

/**
 * the renderers' flags. No MSAA (#62): every layer is an alpha-blended
 * full-coverage quad, so multisampling smooths nothing and doubles
 * framebuffer bandwidth; low-power keeps dual-GPU laptops on the integrated GPU
 */
export const GL_FLAGS = { antialias: false, powerPreference: "low-power" } as const;

/** the light's opening intensity before the first tick writes it */
export const BEAM_REST = 0.3;

/** the live options' defaults: what the page gets without asking */
export const SCENE_DEFAULTS = {
  layerSpread: 1,
  figureRelief: 0.5,
  beamGlow: 1,
  flameDrift: true,
  idleDrift: false,
  orbitYaw: 3.5,
  orbitPitch: 2.5,
  reliefMax: 0.8,
} as const;
