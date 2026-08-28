"""The scene camera, transcribed from PentecostParallax.tsx, so the recut can
reason about parallax in plate pixels before anything is rendered.

Every cut plane is registered from (0, 0, baseZ): a row of any layer projects
there exactly where the flat plate's row would. Away from that camera the
layers slide against each other — a nearer plane magnifies more about the
camera's aim — and the slide is what exposes fills, seams and band edges.
shear_px() measures it for a pair of depths at one plate row, worst_shear()
over every waypoint, aspect and pointer extreme the site can reach.

Mirrored constants are named for their source; keep them in step with it.
"""

from dataclasses import dataclass
from itertools import product
import math

# PentecostParallax.tsx
FOV = 38.0                          # PerspectiveCamera(38, …)
IW = 16.0
PLATE_W, PLATE_H = 2048, 2519
IH = IW * PLATE_H / PLATE_W
BACKDROP_Z = -5.6
DOVE_V = 0.033
LATERAL_MAX = 0.06
DOLLY_EASE = 0.35                   # zn = z * (spread + ease * 0.35)
POINTER_GAIN = (-0.10, -0.18)       # camera offset per unit of pointer x, y
WAYPOINTS = [
    {"band": (0.26, 0.84), "u": 0.0},
    {"band": (0.30, 0.74), "u": -0.05},
    {"band": (0.28, 0.64), "u": 0.05},
    {"band": (0.30, 0.58), "u": 0.0},
    {"band": (-0.02, 0.20), "u": 0.0, "aim": "dove", "at": 0.6},
]
# App.tsx: <PentecostParallax layerSpread={1.25} />
LAYER_SPREAD = 1.25

# the sweep worst_shear() covers
ASPECTS = (16 / 9, 4 / 3)
POINTER_EXTREMES = tuple(product((-1.0, 0.0, 1.0), repeat=2))


@dataclass(frozen=True)
class Camera:
    x: float
    y: float
    z: float
    base_z: float
    mult: float     # every authored z is scaled by this at the current scroll
    aspect: float


def tan_half_fov() -> float:
    return math.tan(math.radians(FOV) / 2)


def base_z(aspect: float) -> float:
    """Registration distance: cover-fit of the image extent at this aspect."""
    t = tan_half_fov()
    return 0.95 * min(IH / 2 / t, IW / 2 / (t * aspect))


def scroll_mult(waypoint: int, spread: float = LAYER_SPREAD) -> float:
    """The z multiplier with the page scrolled so `waypoint`'s section sits
    in frame: each section is one viewport tall, so scroll progress is the
    section index over the last one, smoothstepped as the component does."""
    p = waypoint / (len(WAYPOINTS) - 1)
    return spread + p * p * (3 - 2 * p) * DOLLY_EASE


def camera(waypoint: int, aspect: float, pointer: tuple[float, float] = (0.0, 0.0),
           spread: float = LAYER_SPREAD, dove_z: float = -3.0) -> Camera:
    """The camera at rest on `waypoint` (its section's own frame), nudged by a
    pointer in [-1, 1]^2 and clamped exactly as the component clamps it."""
    wp = WAYPOINTS[waypoint]
    bz = base_z(aspect)
    mult = scroll_mult(waypoint, spread)
    t = tan_half_fov()
    z = max(bz * 0.12, min(bz, (wp["band"][1] - wp["band"][0]) / 2 * IH / t))
    hh = z * t
    if wp.get("aim") == "dove":
        zl = dove_z * mult
        yl = (0.5 - DOVE_V) * IH * ((bz - zl) / bz)
        y = yl - (2 * wp.get("at", 0.6) - 1) * hh / (z / (z - zl))
    else:
        y = (0.5 - (wp["band"][0] + wp["band"][1]) / 2) * IH
    x = wp.get("u", 0.0) * IW + pointer[0] * POINTER_GAIN[0]
    y += pointer[1] * POINTER_GAIN[1]
    lim_y = max(0.0, IH * 0.9 - hh)
    lim_x = min(max(0.0, IW / 2 - hh * aspect), IW * LATERAL_MAX)
    return Camera(x=max(-lim_x, min(lim_x, x)), y=max(-lim_y, min(lim_y, y)), z=z,
                  base_z=bz, mult=mult, aspect=aspect)


def _plane(z: float, cam: Camera) -> tuple[float, float]:
    """(scale, distance) of the layer authored at z: the plane sits at
    z * mult, rescaled so it still registers from (0, 0, baseZ)."""
    zn = z * cam.mult
    return (cam.base_z - zn) / cam.base_z, cam.z - zn


def screen_y(v: float, z: float, cam: Camera) -> float:
    """Where plate row v (0 = top) of the layer authored at z lands on screen,
    as a vertical tangent (±tan(fov/2) are the frame's edges)."""
    k, d = _plane(z, cam)
    return ((0.5 - v) * IH * k - cam.y) / d


def row_seen(z: float, s: float, cam: Camera) -> float:
    """The plate row the layer authored at z shows at screen tangent s."""
    k, d = _plane(z, cam)
    return 0.5 - (s * d + cam.y) / k / IH


def shear_px(z_near: float, z_far: float, v: float, cam: Camera) -> float:
    """Plate pixels by which the far layer has slid against the near one at
    the near layer's row v: positive means the far layer shows a row that
    far BELOW v where v itself lands. For a face at v on a figure plane
    against the wall, that is the strip of wall revealed above the face —
    all of it from inside the figure's own hole."""
    return (row_seen(z_far, screen_y(v, z_near, cam), cam) - v) * PLATE_H


def in_frame(v: float, z: float, cam: Camera) -> bool:
    return abs(screen_y(v, z, cam)) <= tan_half_fov()


def worst_shear(z_near: float, z_far: float, v: float,
                spread: float = LAYER_SPREAD) -> tuple[float, dict]:
    """The largest |shear_px| for this pair at row v over every waypoint,
    aspect and pointer extreme that actually frames the row, and where it
    happens."""
    best = (0.0, {"waypoint": None, "aspect": None, "pointer": None})
    for wp, aspect, pointer in product(range(len(WAYPOINTS)), ASPECTS, POINTER_EXTREMES):
        cam = camera(wp, aspect, pointer, spread)
        if not in_frame(v, z_near, cam):
            continue
        px = abs(shear_px(z_near, z_far, v, cam))
        if px > best[0]:
            best = (px, {"waypoint": wp, "aspect": aspect, "pointer": pointer})
    return best
