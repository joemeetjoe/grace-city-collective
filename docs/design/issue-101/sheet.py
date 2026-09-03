"""#101: the AVIF colour textures beside the WebP they replace, 1:1, at the
hero and the give stop on both tiers — the crops of two cdp-shot captures
of the same build, one under the AVIF verdict and one with --no-avif, plus
the difference between them amplified so the eye finds where the encoders
disagree.

Usage (the shots: tools/README.md, the shot gate, with --no-avif for the
second set):
  python3 docs/design/issue-101/sheet.py <shots-webp-dir> <shots-avif-dir> <tier> <out-dir>
      e.g. sheet.py shots/desktop-webp shots/desktop desktop docs/design/issue-101

Pillow only. The crop boxes are in device pixels of the 1600x900 @2 desktop
and 390x844 @3 mobile captures.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

# (shot, box) per stop: the praying apostle's head and robe at the hero, the
# left-hand faces beside the give panel on desktop, the robes under it on mobile
BOXES = {
    "desktop": {"hero": ("00-hero", (1135, 865, 1775, 1345)), "give": ("04-give", (262, 516, 902, 996))},
    "mobile": {"hero": ("00-hero", (210, 1132, 710, 1632)), "give": ("04-give", (0, 2212, 600, 2532))},
}
GAIN = 8

webp_dir, avif_dir, tier, out_dir = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], Path(sys.argv[4])
font = ImageFont.load_default(size=15)
for stop, (shot, box) in BOXES[tier].items():
    a = Image.open(webp_dir / f"{shot}.png").convert("RGB").crop(box)
    b = Image.open(avif_dir / f"{shot}.png").convert("RGB").crop(box)
    d = np.abs(np.asarray(a, np.int16) - np.asarray(b, np.int16))
    over8 = float((d.max(axis=2) > 8).mean() * 100)
    diff = Image.fromarray(np.clip(d * GAIN, 0, 255).astype(np.uint8))
    cells = [(f"{tier} {stop}  WebP q80", a), (f"{tier} {stop}  AVIF q64", b),
             (f"|WebP - AVIF| x{GAIN}   {over8:.2f}% of pixels over 8, max {int(d.max())}", diff)]
    w, h = a.size
    label = 24
    sheet = Image.new("RGB", (3 * w, h + label), (0, 0, 0))
    draw = ImageDraw.Draw(sheet)
    for i, (text, im) in enumerate(cells):
        draw.text((i * w + 6, 4), text, fill=(235, 225, 205), font=font)
        sheet.paste(im, (i * w, label))
    out = out_dir / f"{tier}-{stop}.png"
    sheet.save(out, optimize=True)
    print(f"{out}  {sheet.size[0]}x{sheet.size[1]}  {out.stat().st_size / 1024:.0f} kB  over8 {over8:.2f}%")
