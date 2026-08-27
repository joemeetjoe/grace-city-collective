"""LaMa inpainting for the recut fills (issue #19).

A thin wrapper over simple-lama-inpainting's big-lama, loaded lazily so the
rest of the pipeline (and its tests) never import torch. Weights
(big-lama.pt, ~196 MB) download once into ~/.cache/torch/hub/checkpoints.

LaMa's Fourier convolutions continue repeating textures — the plate's
engraved hatching — on the plate's own rows, which is what a tiled patch
cannot do at a hole boundary.

The full 2048x2519 plate does not fit a 16 GB machine in one pass (it swaps
for 10+ minutes), so inference runs in overlapping windows that touch the
hole, ramp-blended where windows overlap. Each window sees WINDOW px of
context, far more than the hatch period, so per-window fills agree.
"""

import numpy as np
from PIL import Image

WINDOW = 1024       # inference window, px (multiple of 8)
OVERLAP = 192       # windows overlap this much; blend ramps across it

_model = None


def _lama():
    global _model
    if _model is None:
        from simple_lama_inpainting import SimpleLama
        _model = SimpleLama()
    return _model


def _inpaint_once(img: np.ndarray, hole: np.ndarray) -> np.ndarray:
    out = _lama()(Image.fromarray(img), Image.fromarray((hole > 0).astype(np.uint8) * 255))
    # the model pads to a multiple of 8; crop back to the input size
    return np.asarray(out.convert("RGB"))[: img.shape[0], : img.shape[1]]


def windows(H: int, W: int, size: int = WINDOW, overlap: int = OVERLAP) -> list[tuple[int, int, int, int]]:
    """(y0, y1, x0, x1) windows covering HxW, each `size` px where possible,
    stepping size-overlap. The last window in each axis is pulled back to
    the edge so every window is full-size (LaMa likes fixed context)."""
    def starts(n: int) -> list[int]:
        if n <= size:
            return [0]
        step = size - overlap
        s = list(range(0, n - size, step))
        s.append(n - size)
        return s
    return [(y, min(y + size, H), x, min(x + size, W)) for y in starts(H) for x in starts(W)]


def _ramp(n: int, overlap: int) -> np.ndarray:
    """1-D blend weight: linear ramp up over `overlap` px, flat, ramp down."""
    w = np.ones(n, np.float32)
    r = np.linspace(0, 1, overlap + 2, dtype=np.float32)[1:-1]
    k = min(overlap, n // 2)
    w[:k] = r[:k]
    w[n - k:] = r[:k][::-1]
    return w


def inpaint(img: np.ndarray, hole: np.ndarray, log=None) -> np.ndarray:
    """Fill `hole` (1 = replace) in an HxWx3 uint8 image. LaMa ignores the
    pixels under the mask, so what the hole contains does not matter.
    Pixels outside the hole are returned untouched."""
    H, W = hole.shape
    acc = np.zeros((H, W, 3), np.float32)
    wsum = np.zeros((H, W, 1), np.float32)
    wins = [w for w in windows(H, W) if hole[w[0]:w[1], w[2]:w[3]].any()]
    for i, (y0, y1, x0, x1) in enumerate(wins):
        if log:
            log(f"  lama window {i + 1}/{len(wins)} ({y0},{x0})")
        out = _inpaint_once(img[y0:y1, x0:x1], hole[y0:y1, x0:x1]).astype(np.float32)
        w = np.outer(_ramp(y1 - y0, OVERLAP), _ramp(x1 - x0, OVERLAP))[..., None]
        acc[y0:y1, x0:x1] += out * w
        wsum[y0:y1, x0:x1] += w
    filled = np.where(wsum > 0, acc / np.maximum(wsum, 1e-6), img.astype(np.float32))
    m = (hole > 0)[..., None]
    return np.where(m, filled, img).clip(0, 255).astype(np.uint8)
