#!/usr/bin/env python
"""
The metrics behind the fallback faces (#106): for each web font the site
sets, the vertical metrics and the average character width of the latin
file it ships, and the same width for the local face its fallback is drawn
over. src/theme/fontFallback.ts turns them into the size-adjust and
ascent/descent/line-gap overrides of a `Geist Fallback` and a `Cormorant
Garamond Fallback` @font-face, so a headline painted in the local face
before the woff2 lands takes the same line boxes and moves nothing when the
swap happens.

Writes src/theme/fontMetrics.json; `--check` recomputes and compares with
what is on disk without writing, like tools/poster/ladder.py. Runs under
the dore-recut venv, which has fontTools and brotli (woff2):

    ~/Projects/dore-recut/.venv-recut/bin/python tools/fonts/metrics.py [--check]

Which metrics: hhea ascender, descender and lineGap. Chrome takes hhea on
macOS (CoreText) and, on Windows, the OS/2 typo metrics when the font's
USE_TYPO_METRICS bit is set — both files here set it and their typo values
equal their hhea values, so the choice does not matter for these two; the
script refuses a font where the two disagree rather than guess. Width: the
advance of a–z and the space, weighted by their frequency in English (the
Capsize approach), measured the same way on the web file and the local
face; size-adjust is their ratio, and each override is the web font's
metric divided by it, so the local face's own metrics never show through.

The local faces are Arial for the sans and Georgia for the serif: both are
on macOS, Windows and (via the same-metric Liberation Sans / Gelasio)
most Linux and Android font configurations, and Georgia is what the site's
own stacks already fall back to. The system copies read here are macOS's;
Arial and Georgia have kept the same advances across platforms for decades.

The overrides are recomputed in TypeScript from the checked-in metrics
(src/theme/fontFallback.test.ts): both sides round to four decimals with
floor(x * 10000 + 0.5) / 10000, so the two agree bit for bit.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "src" / "theme" / "fontMetrics.json"
LOCAL_FONTS = Path("/System/Library/Fonts/Supplemental")

# the faces: key, web family, its latin file, the fallback's family and local face
FACES = [
    {
        "key": "sans",
        "family": "Geist Variable",
        "file": "node_modules/@fontsource-variable/geist/files/geist-latin-wght-normal.woff2",
        "fallbackFamily": "Geist Fallback",
        "localFamily": "Arial",
        "localFile": "Arial.ttf",
    },
    {
        "key": "serif",
        "family": "Cormorant Garamond",
        "file": "node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-400-normal.woff2",
        "fallbackFamily": "Cormorant Garamond Fallback",
        "localFamily": "Georgia",
        "localFile": "Georgia.ttf",
    },
]

# letter frequency in English text, per cent (Lewand, Cryptological
# Mathematics), plus the space at one per five and a half letters
FREQUENCY = {
    "a": 8.167, "b": 1.492, "c": 2.782, "d": 4.253, "e": 12.702, "f": 2.228, "g": 2.015,
    "h": 6.094, "i": 6.966, "j": 0.153, "k": 0.772, "l": 4.025, "m": 2.406, "n": 6.749,
    "o": 7.507, "p": 1.929, "q": 0.095, "r": 5.987, "s": 6.327, "t": 9.056, "u": 2.758,
    "v": 0.978, "w": 2.360, "x": 0.150, "y": 1.974, "z": 0.074, " ": 18.0,
}


def round4(x: float) -> float:
    """four decimals, half up — the same expression as fontFallback.ts's round4"""
    return math.floor(x * 10000 + 0.5) / 10000


def x_width_avg(font: TTFont) -> float:
    """the frequency-weighted advance of a–z and the space, in font units"""
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    total = 0.0
    weight = 0.0
    for ch, w in FREQUENCY.items():
        glyph = cmap.get(ord(ch))
        if glyph is None:
            raise SystemExit(f"{font.reader.file.name}: no glyph for {ch!r}")
        total += hmtx[glyph][0] * w
        weight += w
    return total / weight


def vertical(font: TTFont, name: str) -> dict[str, int]:
    """hhea ascent, descent and lineGap; an error when OS/2 typo disagrees while USE_TYPO_METRICS is set"""
    hhea = font["hhea"]
    os2 = font["OS/2"]
    metrics = {"ascent": hhea.ascent, "descent": hhea.descent, "lineGap": hhea.lineGap}
    if os2.fsSelection & (1 << 7):
        typo = {"ascent": os2.sTypoAscender, "descent": os2.sTypoDescender, "lineGap": os2.sTypoLineGap}
        if typo != metrics:
            raise SystemExit(f"{name}: USE_TYPO_METRICS is set and OS/2 typo {typo} differs from hhea {metrics}")
    return metrics


def measure(face: dict[str, str]) -> dict:
    web = TTFont(ROOT / face["file"])
    local = TTFont(LOCAL_FONTS / face["localFile"])
    if "fvar" in web:
        default = {a.axisTag: a.defaultValue for a in web["fvar"].axes}
        if default.get("wght") != 400:
            raise SystemExit(f"{face['file']}: the default instance is wght {default.get('wght')}, not 400")
    web_metrics = {
        "file": face["file"],
        "unitsPerEm": web["head"].unitsPerEm,
        **vertical(web, face["file"]),
        "xWidthAvg": round4(x_width_avg(web)),
    }
    local_metrics = {
        "file": str(LOCAL_FONTS / face["localFile"]),
        "unitsPerEm": local["head"].unitsPerEm,
        "xWidthAvg": round4(x_width_avg(local)),
    }
    return {
        "family": face["family"],
        "fallbackFamily": face["fallbackFamily"],
        "localFamily": face["localFamily"],
        "web": web_metrics,
        "local": local_metrics,
        "overrides": overrides(web_metrics, local_metrics),
    }


def overrides(web: dict, local: dict) -> dict[str, float]:
    """size-adjust and the three overrides, as fractions of the font size; fontFallback.ts's fallbackOverrides"""
    size_adjust = round4((web["xWidthAvg"] / web["unitsPerEm"]) / (local["xWidthAvg"] / local["unitsPerEm"]))
    upm = web["unitsPerEm"]
    return {
        "sizeAdjust": size_adjust,
        "ascent": round4(web["ascent"] / upm / size_adjust),
        "descent": round4(-web["descent"] / upm / size_adjust),
        "lineGap": round4(web["lineGap"] / upm / size_adjust),
    }


def metrics() -> dict:
    return {
        "_generated": "by tools/fonts/metrics.py from the fonts named in it; re-run it, do not edit",
        **{face["key"]: measure(face) for face in FACES},
    }


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", type=Path, default=OUT, help="the metrics json (src/theme/fontMetrics.json)")
    ap.add_argument("--check", action="store_true", help="recompute and compare with the file on disk; write nothing")
    args = ap.parse_args(argv)

    text = json.dumps(metrics(), indent=2) + "\n"
    for key, face in ((f["key"], metrics()[f["key"]]) for f in FACES):
        o = face["overrides"]
        print(
            f"{key:>5} {face['fallbackFamily']!r} over {face['localFamily']}: "
            f"size-adjust {o['sizeAdjust'] * 100:.2f}%  ascent {o['ascent'] * 100:.2f}%  "
            f"descent {o['descent'] * 100:.2f}%  line-gap {o['lineGap'] * 100:.2f}%"
        )
    if args.check:
        if not args.out.exists() or args.out.read_text() != text:
            print(f"{args.out} differs from what the fonts give; re-run without --check", file=sys.stderr)
            return 1
        print(f"{args.out} reproduces byte for byte")
        return 0
    args.out.write_text(text)
    print(f"wrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
