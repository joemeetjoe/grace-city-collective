#!/usr/bin/env python
"""Runtime texture tiers from the recut outputs (issue #26).

Reads dist/ — the build_cuts.py outputs — and writes the two sets the site
ships, public/dore/2048/ (desktop) and public/dore/1024/ (mobile), each with
its own cuts.json of the same shape:

  colour      plate.jpg, plate-backdrop.png, map-*.jpg  ->  lossy WebP, COLOR_Q
  masks       cut-<name>.png, four to a texture in the channels of a lossless
              RGBA WebP: masks-flame-<n>.webp / masks-cut-<n>.webp. Every cut's
              manifest entry names its channel:  mask: { file, channel }
  depth       depth.png, depth-fig*.png  ->  lossless WebP
  crowd map   cropped to the rows its mask covers (it is the whole plate in
              dist/) and given a mapRect like a figure map
  hollowing   a colour texture is only ever sampled under the masks of the
              cuts that use it — a figure map under its own, the plate under
              the cuts without a map of their own. Everything else is
              replaced with a blur of itself (HOLLOW_MARGIN px kept past the
              mask), so the encoder spends nothing on pixels never drawn and
              a mip level blends into a smooth fill rather than a hard edge.
              The backdrop stays whole: it is what shows through.

The 1024 tier is the 2048 tier scaled by half throughout — colour, masks and
depth alike — and every mapRect is a plate fraction, so it is unchanged.
The script is idempotent: a recut regenerates both tiers in place.

The colour codec is WebP. AVIF halves the bytes again but the 2x crops of
hatching (--compare writes them to docs/design/issue-26/) show it smoothing
the line work; see the README there for the verdict.

Usage:
  .venv-recut/bin/python tools/recut/pack_textures.py            # both tiers
  .venv-recut/bin/python tools/recut/pack_textures.py --compare  # codec crops
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
DIST = HERE / "dist"
PUBLIC = HERE.parents[1] / "public" / "dore"
DESIGN = HERE.parents[1] / "docs" / "design" / "issue-26"

TIERS = (2048, 1024)
SOURCE_W = 2048
COLOR_EXT = "webp"
COLOR_Q = 80
CHANNELS = 4
CROP_MARGIN = 4  # source pixels kept around the crowd mask's rows
HOLLOW_MARGIN = 12  # source pixels kept past a mask before the fill takes over
HOLLOW_SIGMA = 12  # of the fill's blur

# exact: libwebp otherwise zeroes RGB under a zero alpha — three masks lost wherever the fourth is empty
LOSSLESS = {"lossless": True, "quality": 100, "method": 6, "exact": True}


# ----------------------------------------------------------------------------
# channel packing

def pack_channels(masks: list[np.ndarray]) -> np.ndarray:
    """Up to four greyscale masks as the channels of one RGBA array, short
    groups padded with empty channels."""
    if not 1 <= len(masks) <= CHANNELS:
        raise ValueError(f"pack_channels: {len(masks)} masks, want 1..{CHANNELS}")
    shape = masks[0].shape
    if any(m.shape != shape for m in masks):
        raise ValueError("pack_channels: masks differ in shape")
    packed = np.zeros(shape + (CHANNELS,), np.uint8)
    for i, m in enumerate(masks):
        packed[..., i] = m
    return packed


def unpack_channels(packed: np.ndarray, n: int) -> list[np.ndarray]:
    return [packed[..., i].copy() for i in range(n)]


def plan_packs(cuts: list[dict]) -> list[tuple[str, list[str]]]:
    """Which masks share a texture: (file, names) in channel order. Flames
    and the other cuts pack separately; the figures go nearest first, so the
    hero's foreground apostles share the first file and one preload covers
    them."""
    flames = [c["name"] for c in cuts if c["isFlame"]]
    others = [c["name"] for c in sorted(cuts, key=lambda c: -c["z"]) if not c["isFlame"]]
    packs: list[tuple[str, list[str]]] = []
    for group, names in (("flame", flames), ("cut", others)):
        for i in range(0, len(names), CHANNELS):
            packs.append((f"masks-{group}-{i // CHANNELS}.webp", names[i:i + CHANNELS]))
    return packs


# ----------------------------------------------------------------------------
# manifest

def texture_name(name: str) -> str:
    """A dist/ colour or depth file's name in a tier."""
    stem, _, ext = name.rpartition(".")
    return f"{stem}.{COLOR_EXT if ext == 'jpg' else 'webp'}"


def mask_rows(mask: np.ndarray, margin: int = CROP_MARGIN) -> tuple[int, int]:
    """The [y0, y1) rows a mask touches, with a margin, clamped to the image."""
    rows = np.flatnonzero(mask.max(axis=1))
    if rows.size == 0:
        return 0, mask.shape[0]
    return max(0, int(rows[0]) - margin), min(mask.shape[0], int(rows[-1]) + 1 + margin)


def crowd_rect(mask: np.ndarray) -> list[float]:
    """The plate fraction [x, y, w, h] the crowd map needs: full width, the
    rows its mask covers."""
    y0, y1 = mask_rows(mask)
    h = mask.shape[0]
    return [0.0, y0 / h, 1.0, (y1 - y0) / h]


def build_manifest(cuts: list[dict], packs: list[tuple[str, list[str]]],
                   rects: dict[str, list[float]] | None = None) -> list[dict]:
    """The tier's cuts.json: every entry as authored, its map/depthMap renamed
    to the tier's encoding, a mapRect for any cut cropped here, and a mask
    reference {file, channel} into the packed textures."""
    where = {name: (file, ch) for file, names in packs for ch, name in enumerate(names)}
    out = []
    for c in cuts:
        entry = dict(c)
        for key in ("map", "depthMap"):
            if key in entry:
                entry[key] = texture_name(entry[key])
        if rects and c["name"] in rects:
            entry["mapRect"] = rects[c["name"]]
        file, channel = where[c["name"]]
        entry["mask"] = {"file": file, "channel": channel}
        out.append(entry)
    return out


def resolve_masks(manifest: list[dict], tier_dir: Path) -> dict[str, tuple[Path, int]]:
    """Every cut's mask as (path, channel), checked to exist: the file is
    there and has that channel."""
    found = {}
    for c in manifest:
        ref = c["mask"]
        path = tier_dir / ref["file"]
        if not path.exists():
            raise FileNotFoundError(f"{c['name']}: {path}")
        bands = len(Image.open(path).getbands())
        if not 0 <= ref["channel"] < bands:
            raise ValueError(f"{c['name']}: channel {ref['channel']} of {bands} in {path.name}")
        found[c["name"]] = (path, ref["channel"])
    return found


# ----------------------------------------------------------------------------
# encoding

def scaled(im: Image.Image, scale: float) -> Image.Image:
    if scale == 1:
        return im
    return im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)


def save_color(im: Image.Image, path: Path, quality: int = COLOR_Q) -> None:
    fmt = path.suffix[1:].upper()
    kw = {"quality": quality, "method": 6} if fmt == "WEBP" else {"quality": quality}
    im.convert("RGB").save(path, format=fmt, **kw)


def save_lossless(arr: np.ndarray, path: Path) -> None:
    """Masks and depth: lossless WebP, RGBA for packs, RGB for a grey field
    (libwebp has no grey mode; its colour transform makes it nearly free)."""
    im = Image.fromarray(arr, "RGBA" if arr.ndim == 3 else "L")
    if arr.ndim == 2:
        im = im.convert("RGB")
    im.save(path, format="WEBP", **LOSSLESS)


def load_grey(path: Path) -> np.ndarray:
    return np.asarray(Image.open(path).convert("L"))


def hollow(image: np.ndarray, keep: np.ndarray, margin: int = HOLLOW_MARGIN,
           sigma: float = HOLLOW_SIGMA) -> np.ndarray:
    """The image untouched wherever `keep` (any mask at any resolution) is
    nonzero, plus `margin` pixels around that; a blur of the image elsewhere."""
    h, w = image.shape[:2]
    inside = (cv2.resize(keep, (w, h), interpolation=cv2.INTER_LINEAR) > 0).astype(np.uint8)
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * margin + 1, 2 * margin + 1))
    inside = cv2.dilate(inside, k).astype(bool)
    fill = cv2.GaussianBlur(image, (0, 0), sigma)
    return np.where(inside[..., None] if image.ndim == 3 else inside, image, fill)


def hollowed(im: Image.Image, keep: np.ndarray) -> Image.Image:
    return Image.fromarray(hollow(np.asarray(im.convert("RGB")), keep))


def write_tier(cuts: list[dict], width: int, dist: Path = DIST, public: Path = PUBLIC) -> Path:
    """One tier of every runtime texture plus its cuts.json."""
    scale = width / SOURCE_W
    out = public / str(width)
    out.mkdir(parents=True, exist_ok=True)
    for stale in out.iterdir():
        stale.unlink()

    masks = {c["name"]: load_grey(dist / f"cut-{c['name']}.png") for c in cuts}
    packs = plan_packs(cuts)
    for file, names in packs:
        # scale the masks one by one: resizing the packed RGBA premultiplies by
        # the fourth channel and zeroes the other three wherever it is empty
        packed = pack_channels([np.asarray(scaled(Image.fromarray(masks[n], "L"), scale)) for n in names])
        save_lossless(packed, out / file)

    rects = {"crowd": crowd_rect(masks["crowd"])}
    manifest = build_manifest(cuts, packs, rects)

    # the plate is sampled only under the cuts without a map of their own
    plate_keep = np.maximum.reduce([masks[c["name"]] for c in cuts if "map" not in c])
    save_color(scaled(hollowed(Image.open(dist / "plate.jpg"), plate_keep), scale), out / "plate.webp")
    save_color(scaled(Image.open(dist / "plate-backdrop.png"), scale), out / "plate-backdrop.webp")
    for c in cuts:
        if "map" in c:
            im = Image.open(dist / c["map"])
            keep = masks[c["name"]]
            if c["name"] in rects:
                x, y, w, h = rects[c["name"]]
                im = im.crop((round(x * im.width), round(y * im.height),
                              round((x + w) * im.width), round((y + h) * im.height)))
            else:
                x, y, w, h = c["mapRect"]
            mh, mw = keep.shape
            keep = keep[round(y * mh):round((y + h) * mh), round(x * mw):round((x + w) * mw)]
            save_color(scaled(hollowed(im, keep), scale), out / texture_name(c["map"]))
        if "depthMap" in c:
            save_lossless(np.asarray(scaled(Image.open(dist / c["depthMap"]).convert("L"), scale)),
                          out / texture_name(c["depthMap"]))
    save_lossless(np.asarray(scaled(Image.open(dist / "depth.png").convert("L"), scale)), out / "depth.webp")

    (out / "cuts.json").write_text(json.dumps(manifest))
    return out


# ----------------------------------------------------------------------------
# codec comparison

CROPS = {
    # dense hatching: (source, left, top) of a 400x300 crop at plate scale
    "plate": ("plate.jpg", 560, 1500),
    "backdrop": ("plate-backdrop.png", 1220, 1400),
    "map-fig5": ("map-fig5.jpg", 140, 380),
}
CROP_SIZE = (400, 300)
CANDIDATES = [("webp", 78), ("webp", 80), ("webp", 84), ("avif", 60), ("avif", 70), ("avif", 80)]
SHEET = [("webp", 80), ("avif", 60), ("avif", 70)]  # tiled beside the source; the rest only report bytes


def encode_roundtrip(im: Image.Image, fmt: str, quality: int) -> tuple[Image.Image, int]:
    import io
    buf = io.BytesIO()
    kw = {"quality": quality, "method": 6} if fmt == "webp" else {"quality": quality}
    im.convert("RGB").save(buf, format=fmt.upper(), **kw)
    data = buf.getvalue()
    return Image.open(io.BytesIO(data)).convert("RGB"), len(data)


def compare_sheet(im: Image.Image, box: tuple[int, int], label: str) -> tuple[Image.Image, dict[str, int]]:
    """The crop of every candidate encoding beside the source, 2x nearest
    neighbour so a smeared line is a smeared line and not a resampling."""
    w, h = CROP_SIZE
    x, y = box
    cells = [("source", im.convert("RGB"), 0)]
    sizes = {}
    for fmt, q in CANDIDATES:
        dec, n = encode_roundtrip(im, fmt, q)
        sizes[f"{fmt}-q{q}"] = n
        if (fmt, q) in SHEET:
            cells.append((f"{fmt} q{q}  {n / 1024:.0f} kB", dec, n))
    cw, ch, lh = w * 2, h * 2, 28
    cols = 4
    rows = (len(cells) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cw, rows * (ch + lh)), (24, 24, 24))
    draw = ImageDraw.Draw(sheet)
    for i, (name, img, _) in enumerate(cells):
        cx, cy = (i % cols) * cw, (i // cols) * (ch + lh)
        crop = img.crop((x, y, x + w, y + h)).resize((cw, ch), Image.NEAREST)
        sheet.paste(crop, (cx, cy + lh))
        draw.text((cx + 8, cy + 7), f"{label}  {name}", fill=(255, 255, 255))
    return sheet, sizes


def write_comparison(dist: Path = DIST, design: Path = DESIGN) -> dict[str, dict[str, int]]:
    design.mkdir(parents=True, exist_ok=True)
    report = {}
    for label, (src, x, y) in CROPS.items():
        sheet, sizes = compare_sheet(Image.open(dist / src), (x, y), label)
        sheet.save(design / f"crops-{label}.png", optimize=True)
        report[label] = sizes
        print(label, {k: f"{v / 1024:.0f}kB" for k, v in sizes.items()})
    return report


# ----------------------------------------------------------------------------

def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--compare", action="store_true", help="write the codec crop sheets instead of the tiers")
    args = ap.parse_args()
    if args.compare:
        write_comparison()
        return
    cuts = json.loads((DIST / "cuts.json").read_text())
    for width in TIERS:
        out = write_tier(cuts, width)
        total = sum(p.stat().st_size for p in out.iterdir())
        print(f"{out.relative_to(PUBLIC.parents[1])}: {len(list(out.iterdir()))} files, {total / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
