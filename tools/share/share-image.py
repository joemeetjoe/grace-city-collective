#!/usr/bin/env python3
"""
The share card: public/share.jpg, 1200x630, cut from the Doré Pentecost plate
(src/assets/dore-pentecost-dark-2048.jpg) — the band where the flames come
down on the gathered faces — as an ink-to-cream duotone, under 200 kB.
The Open Graph and Twitter tags (src/content/surfaces.ts) point at it by
absolute URL; the card's title and description come from those tags, so the
image carries no type.

    /Users/josephhanson/Projects/dore-recut/.venv-recut/bin/python tools/share/share-image.py

Needs Pillow. Reproducible: the same plate and constants give the same file.
"""
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
PLATE = ROOT / "src/assets/dore-pentecost-dark-2048.jpg"
OUT = ROOT / "public/share.jpg"

WIDTH, HEIGHT = 1200, 630
# where the band starts, as a fraction of the plate's height: just above the
# descending flames, so the crop holds the flames and the faces beneath them
TOP = 0.32
# the brand's ink and cream (src/theme/tokens.ts)
INK, CREAM = "#14100e", "#f9f4ed"
MAX_BYTES = 200 * 1024


def main() -> None:
    plate = Image.open(PLATE).convert("L")
    pw, ph = plate.size
    band_h = round(pw * HEIGHT / WIDTH)
    top = min(round(ph * TOP), ph - band_h)
    band = plate.crop((0, top, pw, top + band_h)).resize((WIDTH, HEIGHT), Image.LANCZOS)
    card = ImageOps.colorize(band, black=INK, white=CREAM)

    for quality in range(82, 40, -4):
        card.save(OUT, "JPEG", quality=quality, optimize=True, progressive=True)
        size = OUT.stat().st_size
        if size <= MAX_BYTES:
            break
    print(f"{OUT.relative_to(ROOT)}: {WIDTH}x{HEIGHT}, quality {quality}, {size / 1024:.0f} kB (band {top}..{top + band_h} of {ph})")


if __name__ == "__main__":
    main()
