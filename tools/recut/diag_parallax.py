"""Offline parallax simulator to hunt duplicated content between layers.

Composites the shipped cut set with each layer shifted horizontally in
proportion to its z (and flames lifted, as the component does mid-scroll).
Writes three images into tools/recut/out-diag/:
  shifted-full.png      backdrop + all cuts
  shifted-nocrowd.png   without the crowd layer
  shifted-nobg.png      cuts over black (no backdrop)
Anything that appears twice in -full but once in one of the others names the
guilty pair.
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
DORE = HERE.parents[1] / "public" / "dore"
OUT = HERE / "out-diag"

SHIFT_PER_Z = 26   # px of horizontal shift per unit z, at 1024 wide
FLAME_LIFT = 90    # px the flames have risen mid-scroll


def shift(img: np.ndarray, dx: int, dy: int) -> np.ndarray:
    out = np.zeros_like(img)
    h, w = img.shape[:2]
    sx0, sx1 = max(0, -dx), min(w, w - dx)
    dx0 = max(0, dx)
    sy0, sy1 = max(0, -dy), min(h, h - dy)
    dy0 = max(0, dy)
    out[dy0:dy0 + (sy1 - sy0), dx0:dx0 + (sx1 - sx0)] = img[sy0:sy1, sx0:sx1]
    return out


def main() -> None:
    OUT.mkdir(exist_ok=True)
    cuts = json.loads((DORE / "cuts.json").read_text())
    plate = np.asarray(Image.open(DORE / "plate.jpg").convert("RGB").resize((1024, 1260))).astype(np.float32)
    backdrop = np.asarray(Image.open(DORE / "plate-backdrop.png").convert("RGB").resize((1024, 1260))).astype(np.float32)

    layers = []
    for c in sorted(cuts, key=lambda c: c["z"]):
        a = np.asarray(Image.open(DORE / f"cut-{c['name']}.png").convert("L")).astype(np.float32) / 255
        # a cut with a dedicated color map samples it instead of the shared
        # plate, exactly as the component does
        src = plate
        if "map" in c:
            src = np.asarray(Image.open(DORE / c["map"]).convert("RGB").resize((1024, 1260))).astype(np.float32)
        layers.append((c, a[..., None], src))

    def composite(base: np.ndarray | None, skip: set[str]) -> np.ndarray:
        img = base.copy() if base is not None else np.zeros_like(plate)
        for c, a, tex in layers:
            if c["name"] in skip:
                continue
            dx = round(c["z"] * SHIFT_PER_Z)
            dy = -FLAME_LIFT if c["isFlame"] else 0
            src = shift(tex * a, dx, dy)
            am = shift(a, dx, dy)
            img = src + img * (1 - am)
        return img

    for tag, base, skip in [
        ("full", backdrop, set()),
        ("nocrowd", backdrop, {"crowd"}),
        ("nobg", None, set()),
    ]:
        Image.fromarray(composite(base, skip).clip(0, 255).astype(np.uint8)).save(OUT / f"shifted-{tag}.png")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
