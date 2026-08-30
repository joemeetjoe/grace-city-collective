#!/usr/bin/env python
"""The wall behind the apostles, synthesized: the plate's rays continued down
through the crowd band.

Why. The crowd map used to be the plate wherever no figure mask claimed the
pixel, with the figure holes filled. SAM's masks undershoot in places, so a
shoulder's edge here and a tuft of hair there survived outside the holes and
floated in the wall once the figure slid off them. Sizing every hole to its
fragment is a losing game; this replaces the whole band, so nothing of the
plate survives inside it and no fragment can float, by construction.

How. The band is drawn as three factors:

  carrier  the engraving's horizontal hatch: a clean patch of bare wall
           (CARRIER_PATCH, right of the beam, above the flames) divided by
           its local mean — unit-mean lines, no tone — tiled across the
           width (overlap-added, so no vertical seams), cut into blocks of
           a whole number of line pitches and stacked down the band in a
           seeded random order, the first block phased to the lines just
           above the seam. The floor rows use the floor hatch, tiled,
           blended in at the pavement line like synth_backdrop.
  guide    build_cuts.brightness_field over the backdrop with the band as
           the hole — the low-frequency tone of the surround (beam,
           vignette, floor) continued into it — corrected at the seam to
           the rows just above (seam_correction), the correction decaying
           into the band.
  raymod   the rays. The clean strip above the flames (SRC_ROWS) blurred
           vertically only — the hatch averages away, the rays' vertical
           edges stay crisp — and normalised to unit mean per row. Each
           band pixel samples the strip along its own ray from the dove
           (radial_map), so the rays keep their angle and widen with depth
           exactly as the plate's do. The strip's left third holds the
           gothic columns; the mirrored right side stands in for it.

  band = carrier * guide * raymod, cross-faded from the backdrop over
  SEAM_PX at the band's top. The bottom edge sits under the floor cut.

The result is written to BOTH dist/map-crowd.jpg (pack_textures crops it to
the crowd's rows) and dist/plate-backdrop.png — one wall, on one plane, so
the two textures agree pixel for pixel wherever a cut moves off them.

Usage: .venv-recut/bin/python tools/recut/ray_wall.py     # re-fill an existing dist/
       then pack_textures.py. build_cuts.py --fill ray runs the same fill.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from dolly import DOVE_V

# plate rows (fractions of height) of bare wall and rays: under the arch
# capitals' beam, above the flame tips (v 0.326)
SRC_ROWS = (0.12, 0.32)
# left of this the source rows hold the gothic columns; the mirrored right
# side stands in, blended over MIRROR_BLEND_PX
MIRROR_X = 0.34
MIRROR_BLEND_PX = 60
# blur (x, y) that averages the hatch away while keeping the rays' edges
RAY_SIGMA = (2.0, 20.0)
# the ray modulation, relative to its row's mean
RAY_RANGE = (0.6, 1.6)
# the ray fan's apex: the dove
ORIGIN = (0.5, DOVE_V)
# bare wall the hatch carrier is cut from, (rows, cols) as plate fractions:
# right of the beam where the rays are faint, above the flames, inside the
# plate's border
CARRIER_PATCH = ((0.20, 0.32), (0.72, 0.98))
# the pitch range the hatch is searched in (plate px)
PITCH_RANGE = (4, 12)
# a carrier block is this many pitches, whichever count lands nearest a whole
# row, so a block repeats in phase
BLOCK_PITCHES = (4, 16)
CARRIER_SEED = 11
# high-pass radius that turns a hatched patch into a unit-mean carrier
CARRIER_SIGMA = 8.0
# the columns (plate fractions) the seam phase and tone are read over
SEAM_COLS = (0.36, 0.64)
# the crossfade from the backdrop into the fill, inside the band's top edge
SEAM_PX = 24
# the seam tone correction: read over SEAM_ROWS above the band, smoothed
# across the width by this sigma, decaying into the band over this depth
SEAM_ROWS = 40
SEAM_TONE_SIGMA = 40.0
SEAM_TONE_DEPTH = 160.0
# the pavement line and the wall->floor blend below it (as synth_backdrop)
FLOOR_LINE = 0.79
FLOOR_BLEND = 0.04
FLOOR_PATCH = ((0.885, 0.965), (0.317, 0.659))  # (rows, cols) as plate fractions


def mirror_left(strip: np.ndarray, mirror_x: float = MIRROR_X,
                blend_px: int = MIRROR_BLEND_PX) -> np.ndarray:
    """The strip with its left `mirror_x` replaced by the mirrored right
    side, blended over `blend_px` around the join."""
    W = strip.shape[1]
    x = np.arange(W, dtype=np.float32)
    join = mirror_x * W
    t = np.clip((x - join) / blend_px + 0.5, 0, 1)
    return strip * t + strip[:, ::-1] * (1 - t)


def ray_modulation(strip: np.ndarray, sigma: tuple[float, float] = RAY_SIGMA,
                   lo_hi: tuple[float, float] = RAY_RANGE) -> np.ndarray:
    """The rays of a wall strip: blurred so the hatch averages away, then
    each row divided by its mean — a unit-mean modulation, clamped."""
    soft = cv2.GaussianBlur(strip.astype(np.float32), (0, 0), sigmaX=sigma[0], sigmaY=sigma[1])
    return np.clip(soft / (soft.mean(axis=1, keepdims=True) + 1e-4), *lo_hi)


def radial_map(shape: tuple[int, int], band: tuple[int, int], src: tuple[int, int],
               origin: tuple[float, float] = ORIGIN) -> tuple[np.ndarray, np.ndarray]:
    """cv2.remap maps for the band rows [band[0], band[1]) of an image of
    `shape`: each pixel samples the source rows [src[0], src[1]] along its own
    ray from `origin` (plate fractions). The band's top row samples the
    source's bottom row and its bottom row the source's top — the nearest
    clean rows land at the seam. Angles from the origin are preserved, so a
    ray widens with distance from the apex as the plate's do."""
    H, W = shape
    ox, oy = origin[0] * W, origin[1] * H
    y0, y1 = band
    ys = np.arange(y0, y1, dtype=np.float32)
    t = (ys - y0) / max(1, y1 - 1 - y0)
    y_src = src[1] + (src[0] - src[1]) * t
    xs = np.arange(W, dtype=np.float32)
    ratio = (y_src - oy) / (ys - oy)
    map_x = ox + (xs[None, :] - ox) * ratio[:, None]
    map_y = np.repeat(y_src[:, None], W, axis=1)
    return map_x.astype(np.float32), map_y.astype(np.float32)


def hatch_pitch(rows: np.ndarray, pitch_range: tuple[int, int] = PITCH_RANGE) -> float:
    """The line pitch (px) of horizontally hatched rows: the first
    autocorrelation peak of the row-mean signal, refined by parabola."""
    sig = rows.astype(np.float32).mean(axis=1)
    sig = sig - sig.mean()
    ac = np.correlate(sig, sig, "full")[len(sig) - 1:]
    ac = ac / (ac[0] + 1e-6)
    lo, hi = pitch_range
    k = int(np.argmax(ac[lo:hi + 1])) + lo
    if 0 < k < len(ac) - 1:
        a, b, c = ac[k - 1], ac[k], ac[k + 1]
        denom = a - 2 * b + c
        k = k + (0.5 * (a - c) / denom if abs(denom) > 1e-9 else 0.0)
    return float(k)


def block_rows(pitch: float, pitches: tuple[int, int] = BLOCK_PITCHES) -> int:
    """Rows per carrier block: the multiple of the pitch nearest a whole
    number of rows, so stacked blocks keep the lines in phase."""
    m = min(range(pitches[0], pitches[1] + 1), key=lambda m: abs(m * pitch - round(m * pitch)))
    return int(round(m * pitch))


def unit_carrier(tile: np.ndarray, sigma: float = CARRIER_SIGMA) -> np.ndarray:
    """A hatched texture divided by its own local mean: unit-mean lines."""
    tile = tile.astype(np.float32)
    return tile / (cv2.GaussianBlur(tile, (0, 0), sigma) + 1e-4)


def tile_x(patch: np.ndarray, width: int) -> np.ndarray:
    """The patch overlap-added across `width` with a Bartlett window along
    x only — the rows stay the rows they are, so the lines never jump."""
    ph, pw = patch.shape
    step = pw // 2
    win = np.bartlett(pw)[None, :].astype(np.float32)
    # tiles start half a patch before the left edge, so every column —
    # the first included — sits under a full-weight part of some window
    canvas = np.zeros((ph, width + 2 * pw), np.float32)
    weight = np.zeros((1, width + 2 * pw), np.float32)
    for x in range(0, width + pw, step):
        canvas[:, x:x + pw] += patch * win
        weight[:, x:x + pw] += win
    return canvas[:, step:step + width] / (weight[:, step:step + width] + 1e-6)


def seam_offset(carrier: np.ndarray, n: int, above: np.ndarray) -> int:
    """The row offset into `carrier` (0..n-1) whose rows best continue the
    line phase of `above`, the rows ending at the seam: a block is a whole
    number of pitches, so the block that follows `above` has the phase of
    the one that matches it, and that is the offset whose row-mean signal
    correlates highest with `above`'s."""
    t = above.astype(np.float32).mean(axis=1)
    t = t - t.mean()
    sig = carrier.mean(axis=1)
    best, best_o = -np.inf, 0
    for o in range(n):
        s = sig[o:o + len(t)]
        if len(s) < len(t):
            break
        s = s - s.mean()
        r = float((s * t).sum() / (np.linalg.norm(s) * np.linalg.norm(t) + 1e-6))
        if r > best:
            best, best_o = r, o
    return best_o


def block_carrier(rows: np.ndarray, n: int, height: int, offset: int = 0,
                  seed: int = CARRIER_SEED) -> np.ndarray:
    """`rows` (unit-mean hatch) continued for `height` rows: cut into blocks
    of `n` rows from `offset` down, stacked in a seeded random order —
    every block starts on the same line phase, so the lines run on without
    a visible repeat."""
    count = (len(rows) - offset) // n
    assert count >= 1, f"carrier of {len(rows)} rows holds no block of {n} from offset {offset}"
    blocks = [rows[offset + n * j:offset + n * (j + 1)] for j in range(count)]
    rng = np.random.default_rng(seed)
    picks = [blocks[i] for i in rng.integers(0, count, size=height // n + 1)]
    return np.concatenate(picks, axis=0)[:height]


def seam_correction(above: np.ndarray, first_row: np.ndarray, depth: int,
                    sigma: float = SEAM_TONE_SIGMA, fall: float = SEAM_TONE_DEPTH) -> np.ndarray:
    """A (depth, W) gain: at the seam, the ratio of the tone just above it
    (`above`, rows x W, hatch smoothed away) to the fill's own first row's
    tone (`first_row`, W), smoothed across the width; decaying to 1 over
    `fall` rows into the band."""
    want = cv2.GaussianBlur(above.astype(np.float32).mean(axis=0)[None, :], (0, 0), sigma)[0]
    have = cv2.GaussianBlur(first_row.astype(np.float32)[None, :], (0, 0), sigma)[0]
    gain = want / (have + 1e-4)
    decay = np.exp(-np.arange(depth, dtype=np.float32) / fall)[:, None]
    return 1 + (gain[None, :] - 1) * decay


def ray_wall(plate: np.ndarray, backdrop: np.ndarray, band_rows: tuple[float, float],
             src_rows: tuple[float, float] = SRC_ROWS, origin: tuple[float, float] = ORIGIN,
             seam_px: int = SEAM_PX) -> np.ndarray:
    """`backdrop` with the band (plate row fractions) replaced by the
    synthesized wall. Both inputs RGB uint8 of the same size; the plate
    supplies the rays and hatch, the backdrop the tone around the band."""
    from build_cuts import brightness_field, tiled

    H, W = plate.shape[:2]
    gray = plate.astype(np.float32).mean(axis=2)
    base = backdrop.astype(np.float32)
    base_gray = base.mean(axis=2)
    y0, y1 = int(H * band_rows[0]), int(H * band_rows[1])
    s0, s1 = int(H * src_rows[0]), int(H * src_rows[1])
    c0, c1 = int(W * SEAM_COLS[0]), int(W * SEAM_COLS[1])

    # the rays, continued
    raymod_src = np.ones_like(gray)
    raymod_src[s0:s1] = ray_modulation(mirror_left(gray[s0:s1]))
    map_x, map_y = radial_map((H, W), (y0, y1), (s0, s1 - 1), origin)
    raymod = cv2.remap(raymod_src, map_x, map_y, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)

    # the tone of the surround, continued
    hole = np.zeros((H, W), np.uint8)
    hole[y0:y1] = 1
    guide = brightness_field(base, hole)[y0:y1]

    # the hatch: clean wall lines, phased to the rows above the seam; the
    # floor's take over below the pavement line
    (r0, r1), (cx0, cx1) = CARRIER_PATCH
    patch = gray[int(H * r0):int(H * r1), int(W * cx0):int(W * cx1)]
    n = block_rows(hatch_pitch(patch))
    wide = tile_x(unit_carrier(patch), W)
    offset = seam_offset(wide[:, c0:c1], n, base_gray[y0 - n:y0, c0:c1])
    wall = block_carrier(wide, n, y1 - y0, offset)
    (f0, f1), (fx0, fx1) = FLOOR_PATCH
    floor_patch = gray[int(H * f0):int(H * f1), int(W * fx0):int(W * fx1), None]
    floor = unit_carrier(tiled(floor_patch, H, W)[..., 0])[y0:y1]
    t = np.clip((np.arange(y0, y1) - H * FLOOR_LINE) / (H * FLOOR_BLEND), 0, 1)[:, None].astype(np.float32)
    carrier = wall * (1 - t) + floor * t

    tone = guide * raymod
    tone *= seam_correction(base_gray[y0 - SEAM_ROWS:y0], tone[0], y1 - y0)
    band = carrier * tone
    alpha = np.clip((np.arange(y0, y1) - y0 + 1) / seam_px, 0, 1)[:, None].astype(np.float32)
    out = base.copy()
    out[y0:y1] = (band * alpha + base_gray[y0:y1] * (1 - alpha))[..., None]
    return out.clip(0, 255).astype(np.uint8)


def qc_sheet(plate: np.ndarray, before: np.ndarray, after: np.ndarray,
             band_rows: tuple[float, float]) -> Image.Image:
    """plate | previous crowd map | new, the band's rows, stacked."""
    H = plate.shape[0]
    y0, y1 = int(H * band_rows[0]) - 60, int(H * band_rows[1]) + 20
    return Image.fromarray(np.concatenate([im[y0:y1] for im in (plate, before, after)], axis=0))


def main() -> None:
    from build_cuts import CROWD_ROWS, DIST, PLATE

    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dist", type=Path, default=DIST)
    args = ap.parse_args()
    dist: Path = args.dist
    plate = np.asarray(Image.open(PLATE).convert("RGB"))
    backdrop = np.asarray(Image.open(dist / "plate-backdrop.png").convert("RGB"))
    before = np.asarray(Image.open(dist / "map-crowd.jpg").convert("RGB"))
    print("synthesizing the wall…")
    out = ray_wall(plate, backdrop, CROWD_ROWS)
    Image.fromarray(out).save(dist / "map-crowd.jpg", quality=85)
    Image.fromarray(out).save(dist / "plate-backdrop.png", optimize=True)
    qc_sheet(plate, before, out, CROWD_ROWS).save(dist / "qc-raywall.jpg", quality=80)
    print(f"wrote {dist / 'map-crowd.jpg'}, {dist / 'plate-backdrop.png'}, {dist / 'qc-raywall.jpg'}")


if __name__ == "__main__":
    main()
