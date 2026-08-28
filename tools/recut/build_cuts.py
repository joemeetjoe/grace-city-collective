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
  cuts.json          [{name, z, isFlame, parent?}] for the component; every
                     flame names the cut it hangs over (a figure, or crowd).
                     The crowd — the wall behind the apostles — sits on the
                     backdrop's plane (dolly.py mirrors the scene camera; see CROWD_Z)
  qc-masks.png       tinted composite of the final masks
  qc-rest.png        cuts composited over the backdrop at rest (should look
                     like the plate)
  crowd-hole.png     the exact crowd-map hole, for fill experiments
  complete/fig<N>-hole.png, -keep.png
                     per hidden figure (completions.SPEC): the shape for the
                     inpainter and the part of it the cut adopts
  map-fig<N>.jpg, depth-fig<N>.png
                     a completed figure's own color/depth textures, cropped
                     to its mapRect — present once complete_figures.py has
                     generated and picked its hidden body

Fills (--fill):
  lama-ring  default. The tiled, tone-matched fill, then LaMa re-inpaints a
             LAMA_RING_PX band just inside every hole boundary so the hatch
             continues on the plate's own rows (issue #19). Needs
             simple-lama-inpainting in .venv-recut; ~3 min on CPU.
  tile       the tiled fill alone; instant, but the hatch phase jumps at the
             boundary and traces each figure's silhouette.

Flame parents: each flame binds to the figure whose head (mask top) is
nearest below its centroid, else the crowd; the component then stacks it just
in front of that parent (issue #27). flame_parents.json beside this script
overrides the choice: {"flame6": "fig13"}.

Usage: .venv-recut/bin/python tools/recut/build_cuts.py [--fill tile|lama-ring]
       .venv-recut/bin/python tools/recut/build_cuts.py --manifest-only
           rewrite dist/cuts.json (flame parents) from the masks already in
           dist/, without touching any texture
"""

import argparse

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import completions as comp
from dolly import BACKDROP_Z

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
# plate rows (fraction of height) whose lowest-row figures sit at FIG_Z[0]
# and FIG_Z[1]. Fixed anchors, not the min/max of whatever figures survive,
# so merging, dropping or re-cutting one mask never rescales the others
# (issue #17). Chosen to reproduce the values the parallax was tuned on.
FIG_Z_ROWS = (0.644, 0.866)
FLAME_Z = [-2.0, -1.7, -1.4]
# a flame binds to a head no further than this below its centroid (fraction
# of plate height), and a lateral offset counts this many times a vertical one
# — a tongue hangs over its head, it does not lean across to a neighbour's
FLAME_REACH = 0.15
FLAME_LATERAL = 2.0
FLAME_PARENTS = HERE / "flame_parents.json"
DOVE_Z, ARCH_Z, FLOOR_Z = -3.0, -2.8, 3.6
# The crowd is the wall behind the apostles, and the backdrop is the same wall
# above them: one plane, so their shared edge never slides. At -0.9 the band's
# straight top edge crossed the backdrop's hatching 28 px out of register at
# the community dolly (35 px at the hero) and read as a strip of foreign wall
# between the heads and the flames (issue #29, docs/experiments/issue-29).
CROWD_Z = BACKDROP_Z
# plate rows (fraction of height) the crowd band spans
CROWD_ROWS = (0.40, 0.815)

# top-left gothic structure, in plate pixels (x0, y0, x1, y1)
ARCH_BOX = (0, 120, 660, 1270)

# clean crowd hatch for the disocclusion fill, in plate pixels (y0, y1, x0, x1)
CROWD_PATCH = (1030, 1220, 1600, 1790)


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


# child -> parent, keyed by out-person/person-NN index. These children are
# head-only slivers (0.1–0.4 % of the plate) that SAM cut apart from the body
# occluding them; left as their own far-back layers they float away from it
# as the camera moves. Unioned into the occluder they travel as one figure.
FIG_MERGE: dict[int, int] = {
    # empty since issue #20: hidden bodies are generated (completions.SPEC)
    # so every figure rides its own depth plane. Merging remains the fallback
    # for a figure whose completion is not worth keeping — e.g. {6: 10} puts
    # the bearded head back on the praying man.
}

# z is read off each figure's lowest row (see figure_z), which pushes a figure
# whose lower body is hidden behind others much too far back. Overrides, in
# the same units as FIG_Z.
FIG_Z_OVERRIDE: dict[int, float] = {
    # Completed figures (completions.SPEC) are placed a step behind their
    # nearest occluder by completions.completed_z, which covers the seated
    # man, the bearded man at right and the praying man that used to be
    # pinned here. Entries win over both the heuristic and that rule.
}


def merge_figures(masks: list[np.ndarray], merge: dict[int, int]) -> dict[int, np.ndarray]:
    """Union each child mask into its parent. Returns {source index: mask} for
    the survivors, so figure names keep their source numbering."""
    for child, parent in merge.items():
        if child not in range(len(masks)) or parent not in range(len(masks)):
            raise KeyError(f"merge {child} -> {parent}: no such figure (have {len(masks)})")
        if child == parent:
            raise ValueError(f"merge {child} -> {parent}: a figure cannot absorb itself")
    out = {i: m.copy() for i, m in enumerate(masks)}
    for child, parent in merge.items():
        out[parent] |= out.pop(child)
    return out


def feather(m: np.ndarray, px: int = FEATHER_PX) -> np.ndarray:
    dist = cv2.distanceTransform(m, cv2.DIST_L2, 3)
    return np.clip(dist / px, 0, 1).astype(np.float32)


def band_alpha(shape: tuple[int, int], top_frac: float, bottom_frac: float,
               feather_px: int = FEATHER_PX) -> np.ndarray:
    """Solid horizontal band alpha, feathered only at its top/bottom edges."""
    H, W = shape
    top, bottom = int(H * top_frac), int(H * bottom_frac)
    rows = np.zeros(H, np.float32)
    r = np.arange(top, bottom)
    rows[top:bottom] = np.clip(np.minimum(r - top + 1, bottom - r) / feather_px, 0, 1)
    return np.repeat(rows[:, None], W, axis=1)


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


def tiled(patch: np.ndarray, H: int, W: int) -> np.ndarray:
    """Overlap-add tile a patch over an HxW canvas with a Bartlett window, so
    repeats blend into each other instead of butting with rectangular seams."""
    ph, pw = patch.shape[:2]
    win = np.outer(np.bartlett(ph), np.bartlett(pw))[..., None].astype(np.float32)
    canvas = np.zeros((H + ph, W + pw, 3), np.float32)
    weight = np.zeros((H + ph, W + pw, 1), np.float32)
    for y in range(0, H, ph // 2):
        for x in range(0, W, pw // 2):
            canvas[y:y + ph, x:x + pw] += patch * win
            weight[y:y + ph, x:x + pw] += win
    return canvas[:H, :W] / (weight[:H, :W] + 1e-6)


def brightness_field(img: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """Low-frequency brightness of the plate around (and diffused into) the
    holes, so synthesized fills pick up the beam of light and the vignette.
    Inpainting runs on a small copy so the guide stays sane even deep inside
    holes wider than any blur radius."""
    H, W = hole.shape
    lum = img.mean(axis=2)
    small = cv2.resize(lum, (W // 8, H // 8), interpolation=cv2.INTER_AREA)
    small_hole = (cv2.resize(hole * 255, (W // 8, H // 8)) > 0).astype(np.uint8)
    small = cv2.inpaint(small.astype(np.uint8), small_hole, 7, cv2.INPAINT_TELEA)
    return cv2.GaussianBlur(
        cv2.resize(small, (W, H), interpolation=cv2.INTER_CUBIC).astype(np.float32),
        (0, 0), 30)


def synth_backdrop(plate: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """Replace hole pixels with wall/floor hatch synthesized from the plate.

    Two clean sample patches (bare wall, bare floor) are overlap-add tiled over
    the canvas, blended at the floor line, and brightness-matched to a
    low-frequency field of the surrounding plate — so the fill picks up the
    beam of light and the corner vignette instead of reading as flat wallpaper.
    """
    H, W = hole.shape
    img = plate.astype(np.float32)
    bright = brightness_field(img, hole)

    wall = tiled(img[350:700, 1300:1900], H, W)
    floor_t = tiled(img[int(H * 0.885):int(H * 0.965), 650:1350], H, W)

    # wall above the pavement line, floor below, short vertical blend
    t = np.clip((np.arange(H) - H * 0.79) / (H * 0.04), 0, 1)[:, None, None].astype(np.float32)
    fill = wall * (1 - t) + floor_t * t
    fill_lum = cv2.GaussianBlur(fill.mean(axis=2), (0, 0), 60)
    fill *= (bright / (fill_lum + 1e-4))[..., None]

    alpha = np.clip(cv2.distanceTransform(hole, cv2.DIST_L2, 3) / 8, 0, 1)[..., None]
    return (fill * alpha + img * (1 - alpha)).clip(0, 255).astype(np.uint8)


# The fill continues the wall at the surrounding brightness: a moved figure
# reveals plain wall, nothing that reads as its shadow. Both dials sit at 1.0
# (no darkening, no contrast cut); lower them for a hint of shadow deep
# inside the larger holes.
CROWD_DARKEN = 1.0      # brightness deep inside a hole, relative to the surround
CROWD_CONTRAST = 1.0    # hatch contrast deep inside a hole, relative to the plate
CROWD_SHADOW_R = 32     # px the shading takes to reach full depth inside a hole
# Doré darkens the wall within ~60px of every figure to throw the lit faces
# forward. A guide that samples that halo makes the fill a dark cloud once
# the figure has moved off it, so open wall this far from any figure is the
# only wall the deep fill matches; the halo tone survives only at the rim.
CROWD_HALO_PX = 64
# the hole grows this much before filling: the plate's engraved rim
# highlights often sit just outside the segmentation mask, and left in the
# crowd they would trace the figure's outline as the layers slide apart
CROWD_HOLE_GROW = 7

# LaMa re-inpaints this band inside each hole boundary (see ring_mask). Wide
# enough to bend the tile's hatch onto the plate's rows; narrow enough that
# the deep interior — where a learned model smears on a hole this size —
# stays the tone-matched tile fill.
LAMA_RING_PX = 48


def ring_mask(hole: np.ndarray, ring_px: int = LAMA_RING_PX) -> np.ndarray:
    """The band of hole pixels within ring_px of the hole boundary."""
    dist = cv2.distanceTransform(hole, cv2.DIST_L2, 3)
    return ((dist > 0) & (dist <= ring_px)).astype(np.uint8)


def lama_ring(img: np.ndarray, hole: np.ndarray, ring_px: int = LAMA_RING_PX) -> np.ndarray:
    """Re-inpaint the ring just inside `hole` with LaMa, on top of a fill
    that already owns the hole. LaMa sees plate on one side of the ring and
    the fill on the other and continues both, so the hatch phase no longer
    jumps at the silhouette. Imported lazily: only this path needs torch."""
    import lama_fill
    return lama_fill.inpaint(img, ring_mask(hole, ring_px), log=print)


def synth_crowd_map(plate: np.ndarray, hole: np.ndarray,
                    patch_box: tuple[int, int, int, int]) -> np.ndarray:
    """Crowd color texture: the plate wherever the crowd owns the pixel, and
    patch-tiled crowd texture inside the figure/flame-shaped holes —
    brightness-guided by the surroundings, then darkened into shadow."""
    y0, y1, x0, x1 = patch_box
    img = plate.astype(np.float32)
    H, W = hole.shape
    hole = cv2.dilate(hole, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CROWD_HOLE_GROW,) * 2))
    fill = tiled(img[y0:y1, x0:x1], H, W)
    # a figure's absence must not read as its silhouette: every treatment is
    # a diffuse field — zero at the hole boundary, full only deep inside — so
    # no brightness step traces the outline
    dist = cv2.distanceTransform(hole, cv2.DIST_L2, 3)
    soft = cv2.GaussianBlur(np.clip(dist / CROWD_SHADOW_R, 0, 1), (0, 0), 8)
    # the rim continues the plate's local tone (its halo included); deep
    # inside, the fill is open wall
    local = brightness_field(img, hole)
    halo = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CROWD_HALO_PX * 2 + 1,) * 2)
    open_wall = brightness_field(img, cv2.dilate(hole, halo))
    bright = local * (1 - soft) + open_wall * soft
    soft = soft[..., None]
    fill_lum = cv2.GaussianBlur(fill.mean(axis=2), (0, 0), 30)
    fill *= (bright / (fill_lum + 1e-4))[..., None]

    fill = (fill - bright[..., None]) * (1 - (1 - CROWD_CONTRAST) * soft) + bright[..., None]
    fill *= 1 - (1 - CROWD_DARKEN) * soft

    # the hole's plate content is the figure itself — blending any of it back
    # in ghosts the silhouette (its edge highlights especially), so the fill
    # owns every hole pixel outright
    alpha = np.clip(dist, 0, 1)[..., None]
    return (fill * alpha + img * (1 - alpha)).clip(0, 255).astype(np.uint8)


def figure_z(bottoms: dict[int, float],
             override: dict[int, float] | None = None,
             rows: tuple[float, float] = FIG_Z_ROWS) -> dict[int, float]:
    """z per figure from how far down the plate it reaches (further = nearer):
    the lowest row is mapped linearly from the fixed anchor `rows` onto
    FIG_Z and clamped to it, then any explicit overrides. Each figure's z
    depends only on its own mask, never on which other figures exist.

    (The baked depth map was evaluated as an alternative and rejected: on
    this plate its per-figure depth tracks the ground plane, i.e. the same
    lowest-row signal, and it contradicts the authored groupings.)"""
    lo, hi = rows
    z = {i: round(min(FIG_Z[1], max(FIG_Z[0], FIG_Z[0] + (b - lo) / (hi - lo) * (FIG_Z[1] - FIG_Z[0]))), 2)
         for i, b in bottoms.items()}
    for i, v in (override or {}).items():
        if i in z:
            z[i] = v
    return z


def head_top(mask: np.ndarray) -> tuple[float, float]:
    """(x, y) of a figure's topmost pixels, as plate fractions — nobody on
    this plate raises a hand above their head, so the top is the head."""
    H, W = mask.shape
    ys, xs = np.nonzero(mask)
    top = ys.min()
    return float(xs[ys == top].mean()) / W, float(top) / H


def centroid(mask: np.ndarray) -> tuple[float, float]:
    H, W = mask.shape
    ys, xs = np.nonzero(mask)
    return float(xs.mean()) / W, float(ys.mean()) / H


def flame_parent(flame_centroid: tuple[float, float], heads: dict[str, tuple[float, float]],
                 reach: float = FLAME_REACH, lateral: float = FLAME_LATERAL) -> str:
    """The figure whose head is nearest below the flame, or "crowd" when no
    head is under it within reach. Heads above the centroid are not under
    the flame at all (a tongue rests on a head, it is never behind one)."""
    cx, cy = flame_centroid
    best, best_d = "crowd", reach
    for name, (hx, hy) in heads.items():
        dy = hy - cy
        if dy < 0:
            continue
        d = float(np.hypot(lateral * (hx - cx), dy))
        if d < best_d:
            best, best_d = name, d
    return best


def load_flame_overrides(path: Path = FLAME_PARENTS) -> dict[str, str]:
    return json.loads(path.read_text()) if path.exists() else {}


def assign_flame_parents(flames: dict[str, np.ndarray], figures: dict[str, np.ndarray],
                         overrides: dict[str, str] | None = None) -> dict[str, str]:
    """{flame name: parent cut name} for every flame, by name in `figures`
    or "crowd". Overrides win, and must name a flame and a parent that
    exist — a stale entry after a re-cut is a mistake, not a no-op."""
    heads = {name: head_top(m) for name, m in figures.items()}
    parents = {name: flame_parent(centroid(m), heads) for name, m in flames.items()}
    for flame, parent in (overrides or {}).items():
        if flame not in parents:
            raise KeyError(f"flame_parents: no flame named {flame}")
        if parent != "crowd" and parent not in figures:
            raise KeyError(f"flame_parents: {flame} -> {parent}: no such figure")
        parents[flame] = parent
    return parents


def build_manifest(fig_z: dict[int, float], flame_count: int,
                   extras: dict[int, dict] | None = None,
                   flame_parents: dict[str, str] | None = None) -> list[dict]:
    """The cuts.json entries. Cuts sample the shared plate unless they carry
    a dedicated color map: the crowd (its plate region contains the figures)
    and completed figures (their hidden pixels were generated), whose extras
    add map/mapRect/depthMap. A completed figure without its own depth map
    goes flat — the shared depth under its adopted pixels is the occluder's.
    Every flame names the cut it hangs over (flame_parents, else the crowd);
    the component places it just in front of that parent."""
    cuts: list[dict] = []
    for i, z in fig_z.items():
        extra = (extras or {}).get(i, {})
        relief = 0 if ("map" in extra and "depthMap" not in extra) else 1
        cuts.append({"name": f"fig{i}", "z": z, "isFlame": 0, "relief": relief, **extra})
    for i in range(flame_count):
        parent = (flame_parents or {}).get(f"flame{i}", "crowd")
        cuts.append({"name": f"flame{i}", "z": FLAME_Z[i % 3], "isFlame": 1, "parent": parent})
    cuts.append({"name": "crowd", "z": CROWD_Z, "isFlame": 0, "map": "map-crowd.jpg"})
    cuts.append({"name": "dove", "z": DOVE_Z, "isFlame": 0})
    cuts.append({"name": "arch", "z": ARCH_Z, "isFlame": 0})
    cuts.append({"name": "floor", "z": FLOOR_Z, "isFlame": 0})
    return cuts


def crowd_alpha(shape: tuple[int, int], alphas: dict[str, np.ndarray], cuts: list[dict],
                crowd_z: float = CROWD_Z, band: tuple[float, float] = CROWD_ROWS,
                feather_px: int = 8) -> np.ndarray:
    """The crowd's alpha: a solid band over the figure holes (the crowd map
    fills them), minus a window for every cut that sits BEHIND the crowd —
    its own feathered alpha's complement — or the band would cover it at
    rest. Cuts in front punch no hole. With the crowd on the wall plane
    nothing is behind it and the band is plain."""
    a = band_alpha(shape, band[0], band[1], feather_px)
    behind = [alphas[c["name"]] for c in cuts if c["z"] < crowd_z]
    if behind:
        a = a * (1 - np.maximum.reduce(behind))
    return a


def save_mask(name: str, alpha: np.ndarray, size: tuple[int, int]) -> None:
    img = Image.fromarray((alpha * 255).astype(np.uint8), mode="L").resize(size, Image.LANCZOS)
    img.save(DIST / f"cut-{name}.png", optimize=True)


def load_dist_mask(name: str) -> np.ndarray:
    """A saved cut back as a binary mask (its feather thresholded away)."""
    return (np.asarray(Image.open(DIST / f"cut-{name}.png").convert("L")) > 64).astype(np.uint8)


def rebuild_manifest() -> list[dict]:
    """Recompute the flame parents from the masks already in dist/ and
    rewrite cuts.json, every other entry and value preserved — so a change
    of binding never re-inpaints a texture."""
    cuts = json.loads((DIST / "cuts.json").read_text())
    figures = {c["name"]: load_dist_mask(c["name"]) for c in cuts if c["name"].startswith("fig")}
    flames = {c["name"]: load_dist_mask(c["name"]) for c in cuts if c["isFlame"]}
    parents = assign_flame_parents(flames, figures, load_flame_overrides())
    for c in cuts:
        if c["isFlame"]:
            c["parent"] = parents[c["name"]]
    (DIST / "cuts.json").write_text(json.dumps(cuts))
    return cuts


def print_flame_parents(cuts: list[dict]) -> None:
    for c in cuts:
        if c["isFlame"]:
            print(f"  {c['name']} -> {c['parent']}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--fill", choices=("tile", "lama-ring"), default="lama-ring")
    ap.add_argument("--manifest-only", action="store_true",
                    help="rewrite dist/cuts.json from the existing dist/ masks; no textures")
    args = ap.parse_args()
    if args.manifest_only:
        print("flame parents:")
        print_flame_parents(rebuild_manifest())
        return
    fill_mode = args.fill
    DIST.mkdir(exist_ok=True)
    plate = np.asarray(Image.open(PLATE).convert("RGB"))
    gray = np.asarray(Image.open(PLATE).convert("L"))
    H, W = gray.shape
    out_size = (OUT_W, round(OUT_W * H / W))

    print("figures:")
    raw_figures = dedupe([clean(m) for m in load_masks("out-person", "person")])
    # FIG_MERGE is keyed by source file index, which only holds if dedupe()
    # merged nothing — a re-run of SAM with different detections must re-key it
    assert len(raw_figures) == 14, f"expected 14 figures, got {len(raw_figures)}: re-key FIG_MERGE"
    figures = merge_figures(raw_figures, FIG_MERGE)
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
    crowd[int(H * CROWD_ROWS[0]):int(H * CROWD_ROWS[1]), :] = 1
    floor = np.zeros((H, W), np.uint8)
    floor[int(H * 0.78):, :] = 1
    CROWD_ID, FLOOR_ID, ARCH_ID, DOVE_ID = 1000, 1001, 1002, 1003
    layers_by_priority.append((CROWD_ID, crowd))
    layers_by_priority.append((FLOOR_ID, floor))
    layers_by_priority.append((ARCH_ID, arch_mask))
    # figures back-to-front so the nearer figure wins contested pixels
    # (its silhouette reaches further down the plate)
    for i in sorted(figures, key=lambda i: np.flatnonzero(figures[i].any(axis=1)).max()):
        layers_by_priority.append((i, figures[i]))
    layers_by_priority.append((DOVE_ID, dove))
    for j, f in enumerate(flames):
        layers_by_priority.append((2000 + j, f))
    for lid, m in layers_by_priority:
        owner[m.astype(bool)] = lid
    figures = {i: (owner == i).astype(np.uint8) for i in figures}
    # a figure that lost (nearly) everything to nearer layers has nothing to
    # show — its remnant is below the feather radius — yet would still cost a
    # relief mesh in the scene, so it gets no layer
    for i in [i for i, f in figures.items() if f.sum() < MIN_AREA]:
        print(f"  fig{i} owns {int(figures[i].sum())}px — noise, dropped")
        del figures[i]
    flames = [(owner == 2000 + j).astype(np.uint8) for j in range(len(flames))]
    flames = [f for f in flames if f.sum() > 0]
    dove = (owner == DOVE_ID).astype(np.uint8)
    arch_mask = (owner == ARCH_ID).astype(np.uint8)
    crowd = (owner == CROWD_ID).astype(np.uint8)
    floor = (owner == FLOOR_ID).astype(np.uint8)

    # z for each figure from how far down the plate it reaches (further = nearer)
    bottoms = {i: np.flatnonzero(f.any(axis=1)).max() / H for i, f in figures.items()}
    fig_z = figure_z(bottoms)

    # amodal completion (issue #20): author each hidden figure's extension,
    # find what occludes it, adopt the part under the occluders, and step
    # the figure behind them. The hidden pixels themselves come from
    # complete_figures.py; until it has run for a figure, that figure keeps
    # only its visible pixels (and will show a gap when it slides).
    comp_dir = DIST / "complete"
    comp_dir.mkdir(exist_ok=True)
    floor_row = int(H * comp.FLOOR_ROW)
    occl: dict[int, list[int]] = {}
    keeps: dict[int, np.ndarray] = {}
    for i, spec in comp.SPEC.items():
        if i not in figures:
            continue
        reach = comp.reach_region(spec, figures[i], floor_row)
        js = comp.occluders(i, reach, figures, fig_z)
        if not js:
            print(f"  fig{i}: nothing in front of its extension, not completed")
            continue
        occl[i] = js
        keeps[i] = comp.keep_region(reach, js, figures)
        hole = comp.hole_region(spec, figures[i], floor_row, comp.union(js, figures, (H, W)))
        Image.fromarray(hole * 255).save(comp_dir / f"fig{i}-hole.png", optimize=True)
        Image.fromarray(keeps[i] * 255).save(comp_dir / f"fig{i}-keep.png", optimize=True)
    fig_z = comp.completed_z(fig_z, occl, floor=FIG_Z[0])
    fig_z.update({i: v for i, v in FIG_Z_OVERRIDE.items() if i in fig_z})
    extras: dict[int, dict] = {}
    fig_maps: dict[int, np.ndarray] = {}
    for i in sorted(keeps):
        gen = comp_dir / f"fig{i}-gen.png"
        if not gen.exists():
            print(f"  fig{i}: behind {occl[i]}, hidden body not generated yet — visible pixels only")
            continue
        full = plate.copy()
        gen_rgb = np.asarray(Image.open(gen).convert("RGB"))
        full[keeps[i] > 0] = gen_rgb[keeps[i] > 0]
        figures[i] = (figures[i] | keeps[i]).astype(np.uint8)
        x0, y0, w, h = comp.crop_rect(figures[i])
        Image.fromarray(full[y0:y0 + h, x0:x0 + w]).save(DIST / f"map-fig{i}.jpg", quality=88)
        extras[i] = {"map": f"map-fig{i}.jpg", "mapRect": [x0 / W, y0 / H, w / W, h / H]}
        fig_maps[i] = full
        dep = comp_dir / f"fig{i}-depth.png"
        if dep.exists():
            d = Image.open(dep).convert("L").crop((x0, y0, x0 + w, y0 + h))
            d.resize((max(1, w // 2), max(1, h // 2)), Image.LANCZOS).save(DIST / f"depth-fig{i}.png", optimize=True)
            extras[i]["depthMap"] = f"depth-fig{i}.png"
        print(f"  fig{i}: completed behind {occl[i]}, z {fig_z[i]}, +{int(keeps[i].sum())}px"
              f"{'' if 'depthMap' in extras[i] else ' (no depth: flat)'}")

    flames = sorted(flames, key=lambda m: int(np.flatnonzero(m.any(axis=0)).mean()))
    parents = assign_flame_parents(
        {f"flame{i}": f for i, f in enumerate(flames)},
        {f"fig{i}": f for i, f in figures.items()},
        load_flame_overrides())
    print("flame parents:")
    cuts = build_manifest(fig_z, len(flames), extras, parents)
    print_flame_parents(cuts)
    alphas = {}
    for i, f in figures.items():
        alphas[f"fig{i}"] = feather(f)
    for i, f in enumerate(flames):
        alphas[f"flame{i}"] = feather(f, 3)
    alphas["dove"] = feather(dove, 3)
    alphas["arch"] = feather(arch_mask)
    alphas["floor"] = feather(floor)
    alphas["crowd"] = crowd_alpha((H, W), alphas, cuts)

    for name, a in alphas.items():
        save_mask(name, a, out_size)
    (DIST / "cuts.json").write_text(json.dumps(cuts))

    # crowd color map: everything in the band the crowd does not own becomes
    # shadowed crowd fill, so disocclusion reveals never fall through to wall
    band = np.zeros((H, W), np.uint8)
    band[int(H * CROWD_ROWS[0]):int(H * CROWD_ROWS[1])] = 1
    print("filling crowd map…")
    crowd_hole = band & (1 - crowd)
    # the exact hole, for fill experiments that must not re-derive it
    Image.fromarray(crowd_hole * 255).save(DIST / "crowd-hole.png", optimize=True)
    crowd_map = synth_crowd_map(plate, crowd_hole, CROWD_PATCH)
    if fill_mode == "lama-ring":
        # the ring is measured from the hole the fill actually owns (grown)
        grown = cv2.dilate(crowd_hole, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (CROWD_HOLE_GROW,) * 2))
        crowd_map = lama_ring(crowd_map, grown)
    Image.fromarray(crowd_map).save(DIST / "map-crowd.jpg", quality=85)

    # backdrop: fill every cut region (grown a little) from row texture
    hole = np.zeros((H, W), np.uint8)
    for a in alphas.values():
        hole |= (a > 0.02).astype(np.uint8)
    hole = cv2.dilate(hole, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (DILATE_PX * 2 + 1,) * 2))
    print("filling backdrop…")
    backdrop = synth_backdrop(plate, hole)
    if fill_mode == "lama-ring":
        backdrop = lama_ring(backdrop, hole)
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
        if c["name"] == "crowd":
            src = crowd_map
        elif c["name"].startswith("fig") and int(c["name"][3:]) in fig_maps:
            src = fig_maps[int(c["name"][3:])]
        else:
            src = plate
        rest = src * a + rest * (1 - a)
    Image.fromarray(rest.clip(0, 255).astype(np.uint8)).save(DIST / "qc-rest.png")

    total = sum((DIST / f"cut-{c['name']}.png").stat().st_size for c in cuts)
    print(f"{len(cuts)} cuts, masks {total / 1e6:.1f} MB, "
          f"backdrop {(DIST / 'plate-backdrop.png').stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
