"""Build the final parallax cut set from the raw SAM 3 masks.

Inputs (produced by segment_test.py):
  out-person/person-*.png        14 figure masks
  out-flame/flame-*.png          15 flame masks
  out-bird/bird-00.png           the dove
  out-stone_column/*.png         the two gothic columns (arch canopy is
                                 completed by a brightness pass, see arch())

Outputs, in tools/recut/dist/:
  cut-<name>.png     one greyscale alpha mask per layer, 1024px wide
  plate-backdrop.png the plate with every cut region filled back in
                     (row-wise texture fill — the wall is horizontal hatching,
                     so propagating along rows preserves the line pattern)
  cuts.json          [{name, z, isFlame}] for the component
  qc-masks.png       tinted composite of the final masks
  qc-rest.png        cuts composited over the backdrop at rest (should look
                     like the plate)

Usage: .venv-recut/bin/python tools/recut/build_cuts.py
"""

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PLATE = ROOT / "Parallax Scrolling Photo Layers" / "assets" / "dore-pentecost-dark-2048.jpg"
DIST = HERE / "dist"

FEATHER_PX = 6          # soft edge width on every cut
DILATE_PX = 9           # backdrop is inpainted this far past each cut
OUT_W = 1024            # output mask width
IOU_DUP = 0.7           # near-identical detections above this are merged
MIN_AREA = 900          # components smaller than this are noise

# z ranges mirroring the original cuts.json
FIG_Z = (-0.7, 2.6)     # backmost .. frontmost figure
FLAME_Z = [-2.0, -1.7, -1.4]
DOVE_Z, ARCH_Z, FLOOR_Z = -3.0, -2.8, 3.6

# top-left gothic structure, in plate pixels (x0, y0, x1, y1)
ARCH_BOX = (0, 120, 660, 1270)


def load_masks(folder: str, stem: str) -> list[np.ndarray]:
    files = sorted((HERE / folder).glob(f"{stem}-*.png"))
    return [(np.asarray(Image.open(f).convert("L")) > 127).astype(np.uint8) for f in files]


def clean(m: np.ndarray, close_px: int = 5) -> np.ndarray:
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_px * 2 + 1,) * 2)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, k)
    n, lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    keep = np.zeros_like(m)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= MIN_AREA:
            keep[lab == i] = 1
    # fill enclosed holes
    flood = keep.copy()
    ff_mask = np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8)
    cv2.floodFill(flood, ff_mask, (0, 0), 1)
    return keep | (1 - flood)


def dedupe(masks: list[np.ndarray]) -> list[np.ndarray]:
    out: list[np.ndarray] = []
    for m in masks:
        dup = False
        for i, o in enumerate(out):
            inter = int((m & o).sum())
            union = int((m | o).sum())
            if union and inter / union > IOU_DUP:
                out[i] = o | m
                dup = True
                print(f"  merged duplicate (IoU {inter / union:.2f})")
                break
        if not dup:
            out.append(m)
    return out


def feather(m: np.ndarray, px: int = FEATHER_PX) -> np.ndarray:
    dist = cv2.distanceTransform(m, cv2.DIST_L2, 3)
    return np.clip(dist / px, 0, 1).astype(np.float32)


def arch(gray: np.ndarray, columns: list[np.ndarray]) -> np.ndarray:
    """Columns from SAM + a brightness pass to pick up the arched canopy."""
    x0, y0, x1, y1 = ARCH_BOX
    region = np.zeros_like(gray, np.uint8)
    crop = gray[y0:y1, x0:x1].astype(np.float32)
    blur = cv2.GaussianBlur(crop, (0, 0), 4)
    thresh = blur.mean() + 0.9 * blur.std()
    region[y0:y1, x0:x1] = (blur > thresh).astype(np.uint8)
    for c in columns:
        region |= c
    return clean(region, close_px=8)


def synth_backdrop(plate: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """Replace hole pixels with wall/floor hatch synthesized from the plate.

    Two clean sample patches (bare wall, bare floor) are overlap-add tiled over
    the canvas, blended at the floor line, and brightness-matched to a
    low-frequency field of the surrounding plate — so the fill picks up the
    beam of light and the corner vignette instead of reading as flat wallpaper.
    """
    H, W = hole.shape
    img = plate.astype(np.float32)

    # low-frequency brightness field: diffusion-inpaint a small copy so the
    # guide stays sane even deep inside holes wider than any blur radius
    lum = img.mean(axis=2)
    small = cv2.resize(lum, (W // 8, H // 8), interpolation=cv2.INTER_AREA)
    small_hole = (cv2.resize(hole * 255, (W // 8, H // 8)) > 0).astype(np.uint8)
    small = cv2.inpaint(small.astype(np.uint8), small_hole, 7, cv2.INPAINT_TELEA)
    bright = cv2.GaussianBlur(
        cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32),
        (0, 0), 30)

    def tiled(patch: np.ndarray) -> np.ndarray:
        ph, pw = patch.shape[:2]
        win = np.outer(np.bartlett(ph), np.bartlett(pw))[..., None].astype(np.float32)
        canvas = np.zeros((H + ph, W + pw, 3), np.float32)
        weight = np.zeros((H + ph, W + pw, 1), np.float32)
        for y in range(0, H, ph // 2):
            for x in range(0, W, pw // 2):
                canvas[y:y + ph, x:x + pw] += patch * win
                weight[y:y + ph, x:x + pw] += win
        return canvas[:H, :W] / (weight[:H, :W] + 1e-6)

    wall = tiled(img[350:700, 1300:1900])
    floor_t = tiled(img[int(H * 0.885):int(H * 0.965), 650:1350])

    # wall above the pavement line, floor below, short vertical blend
    t = np.clip((np.arange(H) - H * 0.79) / (H * 0.04), 0, 1)[:, None, None].astype(np.float32)
    fill = wall * (1 - t) + floor_t * t
    fill_lum = cv2.GaussianBlur(fill.mean(axis=2), (0, 0), 60)
    fill *= (bright / (fill_lum + 1e-4))[..., None]

    alpha = np.clip(cv2.distanceTransform(hole, cv2.DIST_L2, 3) / 8, 0, 1)[..., None]
    return (fill * alpha + img * (1 - alpha)).clip(0, 255).astype(np.uint8)


def save_mask(name: str, alpha: np.ndarray, size: tuple[int, int]) -> None:
    img = Image.fromarray((alpha * 255).astype(np.uint8), mode="L").resize(size, Image.LANCZOS)
    img.save(DIST / f"cut-{name}.png", optimize=True)


def main() -> None:
    DIST.mkdir(exist_ok=True)
    plate = np.asarray(Image.open(PLATE).convert("RGB"))
    gray = np.asarray(Image.open(PLATE).convert("L"))
    H, W = gray.shape
    out_size = (OUT_W, round(OUT_W * H / W))

    print("figures:")
    figures = dedupe([clean(m) for m in load_masks("out-person", "person")])
    flames = [clean(m, close_px=3) for m in load_masks("out-flame", "flame")]
    flames = [f for f in flames if f.sum() > 0]
    dove = clean(load_masks("out-bird", "bird")[0], close_px=3)
    arch_mask = arch(gray, load_masks("out-stone_column", "stone_column"))
    print(f"{len(figures)} figures, {len(flames)} flames, arch {int(arch_mask.sum())}px")

    # Global exclusive ownership: every pixel belongs to exactly ONE layer, so
    # no content can be drawn twice at different depths. Painted lowest
    # priority first, each later paint overwriting — crowd and floor start as
    # solid bands and end up holding only what nothing else claimed. (The old
    # per-layer subtractions leaked: clean()'s hole-filling stamped the
    # figure-shaped holes right back into the crowd band.)
    owner = np.full((H, W), -1, np.int16)
    layers_by_priority: list[tuple[int, np.ndarray]] = []
    crowd = np.zeros((H, W), np.uint8)
    crowd[int(H * 0.40):int(H * 0.815), :] = 1
    floor = np.zeros((H, W), np.uint8)
    floor[int(H * 0.78):, :] = 1
    CROWD_ID, FLOOR_ID, ARCH_ID, DOVE_ID = 1000, 1001, 1002, 1003
    layers_by_priority.append((CROWD_ID, crowd))
    layers_by_priority.append((FLOOR_ID, floor))
    layers_by_priority.append((ARCH_ID, arch_mask))
    # figures back-to-front so the nearer figure wins contested pixels
    # (its silhouette reaches further down the plate)
    for i in sorted(range(len(figures)), key=lambda i: np.flatnonzero(figures[i].any(axis=1)).max()):
        layers_by_priority.append((i, figures[i]))
    layers_by_priority.append((DOVE_ID, dove))
    for j, f in enumerate(flames):
        layers_by_priority.append((2000 + j, f))
    for lid, m in layers_by_priority:
        owner[m.astype(bool)] = lid
    figures = [(owner == i).astype(np.uint8) for i in range(len(figures))]
    flames = [(owner == 2000 + j).astype(np.uint8) for j in range(len(flames))]
    flames = [f for f in flames if f.sum() > 0]
    dove = (owner == DOVE_ID).astype(np.uint8)
    arch_mask = (owner == ARCH_ID).astype(np.uint8)
    crowd = (owner == CROWD_ID).astype(np.uint8)
    floor = (owner == FLOOR_ID).astype(np.uint8)

    # z for each figure from how far down the plate it reaches (further = nearer)
    bottoms = [np.flatnonzero(f.any(axis=1)).max() / H for f in figures]
    lo, hi = min(bottoms), max(bottoms)
    fig_z = [round(FIG_Z[0] + (b - lo) / (hi - lo) * (FIG_Z[1] - FIG_Z[0]), 2) for b in bottoms]

    cuts, alphas = [], {}
    for i, (f, z) in enumerate(zip(figures, fig_z)):
        cuts.append({"name": f"fig{i}", "z": z, "isFlame": 0})
        alphas[f"fig{i}"] = feather(f)
    for i, f in enumerate(sorted(flames, key=lambda m: int(np.flatnonzero(m.any(axis=0)).mean()))):
        cuts.append({"name": f"flame{i}", "z": FLAME_Z[i % 3], "isFlame": 1})
        alphas[f"flame{i}"] = feather(f, 3)
    cuts.append({"name": "crowd", "z": -0.9, "isFlame": 0})
    alphas["crowd"] = feather(crowd, 8)
    cuts.append({"name": "dove", "z": DOVE_Z, "isFlame": 0})
    alphas["dove"] = feather(dove, 3)
    cuts.append({"name": "arch", "z": ARCH_Z, "isFlame": 0})
    alphas["arch"] = feather(arch_mask)
    cuts.append({"name": "floor", "z": FLOOR_Z, "isFlame": 0})
    alphas["floor"] = feather(floor)

    for name, a in alphas.items():
        save_mask(name, a, out_size)
    (DIST / "cuts.json").write_text(json.dumps(cuts))

    # backdrop: fill every cut region (grown a little) from row texture
    hole = np.zeros((H, W), np.uint8)
    for a in alphas.values():
        hole |= (a > 0.02).astype(np.uint8)
    hole = cv2.dilate(hole, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (DILATE_PX * 2 + 1,) * 2))
    print("filling backdrop…")
    backdrop = synth_backdrop(plate, hole)
    Image.fromarray(backdrop).save(DIST / "plate-backdrop.png", optimize=True)

    # QC images
    tints = np.array([[255, 60, 60], [60, 200, 255], [90, 255, 120], [255, 200, 40],
                      [200, 90, 255], [255, 120, 190], [120, 140, 255], [255, 150, 60],
                      [60, 255, 220], [230, 230, 90], [160, 255, 60], [255, 80, 120]], np.float32)
    qc = plate.astype(np.float32) * 0.4
    for i, (name, a) in enumerate(alphas.items()):
        qc += a[..., None] * tints[i % len(tints)] * 0.55
    Image.fromarray(qc.clip(0, 255).astype(np.uint8)).save(DIST / "qc-masks.png")

    rest = backdrop.astype(np.float32)
    for c in sorted(cuts, key=lambda c: c["z"]):
        a = alphas[c["name"]][..., None]
        rest = plate * a + rest * (1 - a)
    Image.fromarray(rest.clip(0, 255).astype(np.uint8)).save(DIST / "qc-rest.png")

    total = sum((DIST / f"cut-{c['name']}.png").stat().st_size for c in cuts)
    print(f"{len(cuts)} cuts, masks {total / 1e6:.1f} MB, "
          f"backdrop {(DIST / 'plate-backdrop.png').stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
