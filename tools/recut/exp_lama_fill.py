"""Experiment for issue #19: LaMa vs the tiled wall fill in the crowd map.

Builds three crowd maps from the masks already in dist/ (no SAM re-run):
  tile       synth_crowd_map as shipped
  lama       LaMa over the whole (dilated) hole, straight off the plate
  lama-ring  the tile fill, then LaMa over a RING_PX band inside the hole
             boundary only — it reconciles the tile's hatch phase with the
             plate's rows while the deep interior stays the tile fill, so
             a huge hole cannot smear

Outputs, in dist/:
  map-crowd-<variant>.jpg
  exp-lama-<region>.png     side-by-side crops, tile | lama | lama-ring
and prints, per variant: fill tone vs open wall, and hatch-row continuity
across the hole boundary (correlation of the luminance row profile just
inside vs just outside; 1.0 = same rows).

Usage: .venv-recut/bin/python tools/recut/exp_lama_fill.py
"""

import glob
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import build_cuts as bc
import lama_fill

DIST = bc.DIST
RING_PX = 48
# plate-fraction crops for the side-by-side: x0, x1, y0, y1
REGIONS = {
    "mary-group": (0.28, 0.50, 0.38, 0.52),
    "right-cluster": (0.58, 0.82, 0.40, 0.54),
}


def hole_from_dist(H: int, W: int) -> np.ndarray:
    """The crowd map's hole, exactly as build_cuts computed it (crowd-hole.png).
    Falls back to re-deriving it from the feathered masks, which lands a few
    px inside the true silhouette and leaves the plate's rim highlights for
    the inpainter to extrapolate — use only for a rough look."""
    exact = DIST / "crowd-hole.png"
    if exact.exists():
        return (np.asarray(Image.open(exact).convert("L")) > 127).astype(np.uint8)
    print("WARNING: dist/crowd-hole.png missing; re-deriving the hole from feathered masks")
    band = np.zeros((H, W), np.uint8)
    band[int(H * 0.40):int(H * 0.815)] = 1
    others = np.zeros((H, W), np.uint8)
    for f in glob.glob(str(DIST / "cut-*.png")):
        if Path(f).stem in ("cut-crowd", "cut-floor"):
            continue
        a = np.asarray(Image.open(f).convert("L").resize((W, H), Image.BILINEAR))
        others |= (a > 127).astype(np.uint8)
    return band & others


def continuity(map_rgb: np.ndarray, hole: np.ndarray, band: slice) -> float:
    """Hatch-row continuity across the hole boundary. For each column that
    crosses a boundary, correlate the luminance profile of the 24 rows just
    outside with the 24 rows just inside, shifted to the same phase origin —
    if the fill sits on the plate's rows the profiles line up."""
    lum = map_rgb.mean(axis=2)
    d_in = cv2.distanceTransform(hole, cv2.DIST_L2, 3)
    d_out = cv2.distanceTransform(1 - hole, cv2.DIST_L2, 3)
    # ring 3-11px either side of the boundary; the plate's own rim pixels
    # (0-3px) are excluded because the fill swallows them by design
    inner = (d_in > 3) & (d_in <= 11)
    outer = (d_out > 3) & (d_out <= 11)
    rows = np.zeros_like(hole, bool)
    rows[band] = True
    # horizontal hatch: phase is along y, so compare row-mean profiles of
    # short vertical runs; a 1-px row offset flips the sign, so this is a
    # sensitive test
    ys_i, xs_i = np.nonzero(inner & rows)
    ys_o, xs_o = np.nonzero(outer & rows)
    prof_i = np.zeros(lum.shape[0]); cnt_i = np.zeros(lum.shape[0])
    prof_o = np.zeros(lum.shape[0]); cnt_o = np.zeros(lum.shape[0])
    np.add.at(prof_i, ys_i, lum[ys_i, xs_i]); np.add.at(cnt_i, ys_i, 1)
    np.add.at(prof_o, ys_o, lum[ys_o, xs_o]); np.add.at(cnt_o, ys_o, 1)
    ok = (cnt_i > 20) & (cnt_o > 20)
    pi = prof_i[ok] / cnt_i[ok]
    po = prof_o[ok] / cnt_o[ok]
    pi = pi - cv2.GaussianBlur(pi.reshape(-1, 1), (0, 0), 6).ravel()
    po = po - cv2.GaussianBlur(po.reshape(-1, 1), (0, 0), 6).ravel()
    return float(np.corrcoef(pi, po)[0, 1])


def tone(map_rgb: np.ndarray, plate: np.ndarray, hole: np.ndarray) -> tuple[float, float]:
    """Deep-fill luminance vs open wall (plate pixels > 64px from any hole)."""
    d_in = cv2.distanceTransform(hole, cv2.DIST_L2, 3)
    d_out = cv2.distanceTransform(1 - hole, cv2.DIST_L2, 3)
    H = hole.shape[0]
    rows = slice(int(H * 0.40), int(H * 0.56))
    deep = map_rgb[rows].mean(axis=2)[d_in[rows] > 30].mean()
    open_wall = plate[rows].mean(axis=2)[d_out[rows] > 64].mean()
    return float(deep), float(open_wall)


def main() -> None:
    plate = np.asarray(Image.open(bc.PLATE).convert("RGB"))
    H, W, _ = plate.shape
    hole = hole_from_dist(H, W)
    k7 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    hole7 = cv2.dilate(hole, k7)
    print(f"hole: {hole.sum() / (H * W) * 100:.1f}% of plate")

    variants: dict[str, np.ndarray] = {}
    t = time.time()
    variants["tile"] = bc.synth_crowd_map(plate, hole, bc.CROWD_PATCH)
    print(f"tile       {time.time() - t:5.1f}s")

    t = time.time()
    variants["lama"] = lama_fill.inpaint(plate, hole7, log=print)
    print(f"lama       {time.time() - t:5.1f}s")

    t = time.time()
    d_in = cv2.distanceTransform(hole7, cv2.DIST_L2, 3)
    ring = ((d_in > 0) & (d_in <= RING_PX)).astype(np.uint8)
    variants["lama-ring"] = lama_fill.inpaint(variants["tile"], ring, log=print)
    print(f"lama-ring  {time.time() - t:5.1f}s  (ring {ring.sum() / hole7.sum() * 100:.0f}% of hole)")

    band = slice(int(H * 0.40), int(H * 0.56))
    print(f"\n{'variant':10s} {'deep fill':>9s} {'open wall':>9s} {'ratio':>6s} {'row-continuity':>15s}")
    print(f"{'plate':10s} {'':>9s} {'':>9s} {'':>6s} {continuity(plate, hole7, band):15.3f}   (the figures themselves: floor)")
    for name, m in variants.items():
        deep, wall = tone(m, plate, hole7)
        print(f"{name:10s} {deep:9.1f} {wall:9.1f} {deep / wall:6.2f} {continuity(m, hole7, band):15.3f}")
        Image.fromarray(m).save(DIST / f"map-crowd-{name}.jpg", quality=85)

    for rname, (x0, x1, y0, y1) in REGIONS.items():
        box = (slice(int(H * y0), int(H * y1)), slice(int(W * x0), int(W * x1)))
        crops = [variants[k][box] for k in ("tile", "lama", "lama-ring")]
        gap = np.full((crops[0].shape[0], 6, 3), 255, np.uint8)
        side = np.concatenate([crops[0], gap, crops[1], gap, crops[2]], axis=1)
        Image.fromarray(side).save(DIST / f"exp-lama-{rname}.png")
    print(f"\nwrote {', '.join(f'map-crowd-{k}.jpg' for k in variants)} and exp-lama-*.png to {DIST}")


if __name__ == "__main__":
    main()
