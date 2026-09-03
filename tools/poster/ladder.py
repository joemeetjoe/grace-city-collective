#!/usr/bin/env python
"""
The still poster's width ladder (#109): cut the darkened Doré plate
(src/assets/dore-pentecost-dark-2048.jpg, the source; already toned, so no
tone change here) to fixed rungs and encode each in AVIF and WebP, for the
<picture> in src/engine/StaticPoster.tsx to pick from by viewport width and
DPR. The rungs, the resampler and every encoder setting are fixed, so a
re-run writes byte-identical files: `--check` proves it against what is on
disk without writing.

Interpreter: the dore-recut venv, whose Pillow has AVIF and WebP
(tools/README.md):

    ~/Projects/dore-recut/.venv-recut/bin/python tools/poster/ladder.py
    ~/Projects/dore-recut/.venv-recut/bin/python tools/poster/ladder.py --check

The rungs mirror POSTER_RUNGS in src/engine/posterLadder.ts.
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "src/assets/dore-pentecost-dark-2048.jpg"
OUT = ROOT / "src/assets/poster"
STEM = "dore-pentecost-dark"

# widths in px, ascending, from the 2048 plate: a 390 phone at 3x takes 1280,
# Save-Data takes 640 (src/engine/posterLadder.ts)
RUNGS = (640, 960, 1280, 1600, 2048)

# encoder settings, fixed for reproducibility; quality chosen on the 2048 plate
# (an engraving: fine grain, so every codec pays) against the 844 kB WebP it
# replaces — AVIF 60 lands the 2048 rung near half of that, WebP 75 just under it
AVIF = {"quality": 60, "speed": 4}
WEBP = {"quality": 75, "method": 6}


def cut(source: Image.Image, width: int) -> Image.Image:
    """the plate at `width`, height in proportion, Lanczos; RGB for both encoders"""
    if width > source.width:
        raise SystemExit(f"rung {width} is wider than the {source.width} source")
    height = round(source.height * width / source.width)
    return source.resize((width, height), Image.Resampling.LANCZOS).convert("RGB")


def encode(image: Image.Image, fmt: str) -> bytes:
    buf = io.BytesIO()
    if fmt == "avif":
        image.save(buf, "AVIF", **AVIF)
    elif fmt == "webp":
        image.save(buf, "WEBP", **WEBP)
    else:
        raise ValueError(fmt)
    return buf.getvalue()


def ladder(source_path: Path):
    """yield (rung, format, path-name, bytes) for every rung and format"""
    source = Image.open(source_path)
    for width in RUNGS:
        image = cut(source, width)
        for fmt in ("avif", "webp"):
            yield width, fmt, f"{STEM}-{width}.{fmt}", encode(image, fmt)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", type=Path, default=SOURCE, help="the darkened 2048 plate (jpg)")
    ap.add_argument("--out", type=Path, default=OUT, help="directory for the rungs")
    ap.add_argument("--check", action="store_true", help="re-encode and compare with the files on disk; write nothing")
    args = ap.parse_args(argv)

    args.out.mkdir(parents=True, exist_ok=True)
    drift = []
    print(f"{'rung':>5} {'avif kB':>8} {'webp kB':>8}")
    row: dict[str, int] = {}
    for width, fmt, name, data in ladder(args.src):
        path = args.out / name
        if args.check:
            if not path.exists() or path.read_bytes() != data:
                drift.append(name)
        else:
            path.write_bytes(data)
        row[fmt] = len(data)
        if fmt == "webp":
            print(f"{width:>5} {row['avif'] / 1024:>8.1f} {row['webp'] / 1024:>8.1f}")
    if args.check:
        if drift:
            print(f"differs from disk: {', '.join(drift)}", file=sys.stderr)
            return 1
        print(f"every rung in {args.out} reproduces byte for byte")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
