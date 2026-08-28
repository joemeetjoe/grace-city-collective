"""Contact sheet of every figure at the community dolly — the tightest
waypoint — so an edge artifact is found by looking at all of them rather than
at whichever one was noticed (issue #28).

The screenshot comes from tools/shots/cdp-shot.mjs; this script knows where
each figure landed in it. That placement transcribes the camera in
PentecostParallax.tsx (WAYPOINTS, solve(), the per-frame layer rescale) and
App.tsx (layerSpread, five sections), so the constants below must follow them.

At 16:9 the community frame holds ~60 % of the plate's width and the outer
figures fall off it. The camera distance is solved from the band's height and
holds up to an aspect of ~2.75, so a 3700x1350 frame shows the whole ring at
the very same zoom — that is the size to shoot.

Usage:
  pnpm build && pnpm preview --port 4228 &
  node tools/shots/cdp-shot.mjs --url http://localhost:4228/ --out /tmp/sheet \\
       --port 9328 --labels Community --size 3700x1350 \\
       --css "[data-parallax]>div[aria-hidden],[data-parallax]+div,section[data-screen-label]{visibility:hidden}"
  .venv-recut/bin/python tools/recut/contact_sheet.py /tmp/sheet/03-community.png \\
       --out docs/design/issue-28/after.jpg [--dore public/dore]

Each cell is a 1:1 crop of the screenshot around the figure's head and
shoulders — the silhouette against the wall, where a fringe shows.
"""

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DORE = ROOT / "public" / "dore"

# PentecostParallax.tsx
FOV = 38.0
IW = 16.0
IH = IW * 2519 / 2048
COMMUNITY = ((0.30, 0.58), 0.0)      # WAYPOINTS[3]: band, u
# App.tsx
LAYER_SPREAD = 1.25
SECTIONS = 5
COMMUNITY_INDEX = 3


@dataclass(frozen=True)
class Frame:
    """The camera at the community waypoint for a W x H viewport."""
    W: int
    H: int

    @property
    def tan(self) -> float:
        return math.tan(math.radians(FOV) / 2)

    @property
    def aspect(self) -> float:
        return self.W / self.H

    @property
    def base_z(self) -> float:
        # cover-fit against the image extent (resize())
        return 0.95 * min(IH / 2 / self.tan, IW / 2 / (self.tan * self.aspect))

    @property
    def cam(self) -> tuple[float, float, float]:
        (v0, v1), u = COMMUNITY
        z = max(self.base_z * 0.12, min(self.base_z, (v1 - v0) / 2 * IH / self.tan))
        return u * IW, (0.5 - (v0 + v1) / 2) * IH, z

    @property
    def ease(self) -> float:
        # page scroll at the section top, smoothstepped
        p = COMMUNITY_INDEX / (SECTIONS - 1)
        return p * p * (3 - 2 * p)


def layer_z(z: float, frame: Frame) -> float:
    """Where a cut authored at z sits once the scroll has spread the layers."""
    return z * (LAYER_SPREAD + frame.ease * 0.35)


def project(u: float, v: float, z: float, frame: Frame) -> tuple[float, float]:
    """Screen pixel of plate point (u, v) — fractions from the top-left — on
    the cut authored at z. Relief displacement is ignored: it is built to
    project where the flat point does from the registration camera, and the
    dolly moves it only a few pixels."""
    zn = layer_z(z, frame)
    k = (frame.base_z - zn) / frame.base_z
    X, Y = (u - 0.5) * IW * k, (0.5 - v) * IH * k
    cx, cy, cz = frame.cam
    depth = cz - zn
    nx = (X - cx) / (depth * frame.tan * frame.aspect)
    ny = (Y - cy) / (depth * frame.tan)
    return (nx + 1) / 2 * frame.W, (1 - ny) / 2 * frame.H


def figure_boxes(dore: Path, frame: Frame) -> list[tuple[str, tuple[float, float, float, float]]]:
    """(name, screen bbox) per figure cut, from its shipped mask."""
    cuts = json.loads((dore / "cuts.json").read_text())
    out = []
    for c in cuts:
        if not c["name"].startswith("fig"):
            continue
        m = np.asarray(Image.open(dore / f"cut-{c['name']}.png").convert("L")) > 8
        mh, mw = m.shape
        ys, xs = np.nonzero(m)
        x0, y0 = project(xs.min() / mw, ys.min() / mh, c["z"], frame)
        x1, y1 = project((xs.max() + 1) / mw, (ys.max() + 1) / mh, c["z"], frame)
        out.append((c["name"], (x0, y0, x1, y1)))
    return out


def head_crop(shot: np.ndarray, box: tuple[float, float, float, float],
              cell: tuple[int, int]) -> np.ndarray:
    """A cell-sized 1:1 window over the top of the figure's box, clamped to
    the frame."""
    H, W = shot.shape[:2]
    cw, ch = cell
    x0, y0, x1, y1 = box
    left = int(round(min(max((x0 + x1) / 2 - cw / 2, 0), max(W - cw, 0))))
    top = int(round(min(max(y0 - ch * 0.12, 0), max(H - ch, 0))))
    return shot[top:top + ch, left:left + cw]


def tile(crops: list[tuple[str, np.ndarray]], cols: int, cell: tuple[int, int],
         label_h: int = 22) -> np.ndarray:
    """Tile labelled crops into a grid of cols columns. A crop larger than its
    cell is clipped, never resampled — the whole point is 1:1 pixels."""
    cw, ch = cell
    rows = math.ceil(len(crops) / cols)
    sheet = Image.new("RGB", (cols * cw, rows * (ch + label_h)), (0, 0, 0))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=14)
    for i, (label, crop) in enumerate(crops):
        x, y = (i % cols) * cw, (i // cols) * (ch + label_h)
        draw.text((x + 6, y + 4), label, fill=(235, 225, 205), font=font)
        sheet.paste(Image.fromarray(np.ascontiguousarray(crop[:ch, :cw])), (x, y + label_h))
    return np.asarray(sheet)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("shot", type=Path, help="cdp-shot.mjs screenshot of the Community waypoint")
    ap.add_argument("--out", type=Path, required=True, help="sheet to write (jpg)")
    ap.add_argument("--dore", type=Path, default=DORE, help="cuts.json and masks the page renders")
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--cell", default="500x420", help="1:1 crop per figure, WxH")
    args = ap.parse_args()
    cell = tuple(int(v) for v in args.cell.split("x"))
    shot = np.asarray(Image.open(args.shot).convert("RGB"))
    frame = Frame(shot.shape[1], shot.shape[0])
    boxes = figure_boxes(args.dore, frame)
    boxes.sort(key=lambda b: b[1][0])  # left to right across the ring
    crops = [(name, head_crop(shot, box, cell)) for name, box in boxes]
    sheet = tile(crops, args.cols, cell)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet).save(args.out, quality=90)
    print(f"{len(crops)} figures -> {args.out} ({sheet.shape[1]}x{sheet.shape[0]})")


if __name__ == "__main__":
    main()
