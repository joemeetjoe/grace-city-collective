"""Amodal completion of figures hidden behind other figures (issue #20).

SAM only segments what Doré drew, so a figure standing behind another has
no pixels where the front figure covers it. As long as such a figure moved
with its occluder (FIG_MERGE) that was invisible; the moment it gets its own
depth plane, parallax reveals a strip of *nothing* along the occluder's edge.

This module authors, per hidden figure, the region where its hidden body
plausibly is (the "extension"), splits it into

  hole  the shape handed to the inpainting model — compact for a torso,
        and for a body only where it runs toward its occluders — so it
        draws one coherent body (tools/recut/complete_figures.py)
  keep  the part of that body the cut set actually adopts: only pixels the
        occluders own. Anything else Doré would have drawn himself — wall is
        wall — so at rest the reassembled scene still equals the plate; the
        adopted pixels sit under the occluder and show only when it slides.

and gives the completed figure a depth just behind its nearest occluder, so
the strip parallax reveals stays narrow.

Everything here is pure numpy/cv2 geometry, so build_cuts stays torch-free.
"""

from dataclasses import dataclass

import cv2
import numpy as np

FLOOR_ROW = 0.80    # bodies are extruded down to this fraction of the plate height
STEP_BEHIND = 0.3   # a completed figure sits this far behind its nearest occluder
BODY_REACH = 96     # px of hidden margin a body keeps under its occluders
BODY_HOLE = 160     # px the inpainting hole reaches — wider, for a coherent body
MIN_OVERLAP = 5000  # px of the adopted margin a nearer figure must cover to count as an occluder


@dataclass(frozen=True)
class Torso:
    """A body hanging from a head-only mask: shoulders + a column down to
    the floor row. half_w is in plate px."""
    half_w: int


@dataclass(frozen=True)
class Body:
    """A body whose visible part is cut off: a margin around it plus the
    silhouette extruded down to the floor row."""
    reach: int = BODY_REACH
    hole_reach: int = BODY_HOLE


# which figures are hidden behind others, keyed by out-person/person-NN index
SPEC: dict[int, Torso | Body] = {
    2: Torso(150),   # head behind the far-left kneeling man
    6: Torso(170),   # bearded head between Mary's veil and the praying man
    9: Torso(130),   # face behind the praying man's shoulder
    12: Torso(95),   # small head above the bowing man's back
    0: Body(),       # far-left kneeling man, behind the kneeling clasped man
    3: Body(),       # seated man far right, robe behind the bowing man
    4: Body(),       # kneeling clasped man, behind the standing bearded man
    5: Body(),       # standing bearded man, behind Mary
    7: Body(),       # bearded man right, lower body behind the bowing/seated men
    8: Body(),       # clasped-hands man, lower body behind the bowing man
    10: Body(),      # praying man, robe behind Mary
}


def _ellipse(shape: tuple[int, int], px: int) -> np.ndarray:
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (px * 2 + 1,) * 2)


def extrude_down(mask: np.ndarray, bottom: int) -> np.ndarray:
    """Every column of the mask filled from its lowest pixel down to `bottom`."""
    H, W = mask.shape
    out = np.zeros_like(mask, np.uint8)
    cols = np.flatnonzero(mask.any(axis=0))
    if not len(cols):
        return out
    rows = np.arange(H)[:, None]
    last = np.where(mask[:, cols] > 0, rows, -1).max(axis=0)
    sub = (rows > last[None, :]) & (rows <= bottom)
    out[:, cols] = sub.astype(np.uint8)
    return out


def torso(head: np.ndarray, half_w: int, bottom: int) -> np.ndarray:
    """Shoulders (an ellipse under the chin) and a column to `bottom`, minus
    the head; grown a little so the neck joins the invented body."""
    ys, xs = np.nonzero(head)
    cx, chin = int(xs.mean()), int(ys.max())
    out = np.zeros(head.shape, np.uint8)
    cv2.ellipse(out, (cx, chin + 60), (half_w, 90), 0, 0, 360, 1, -1)
    cv2.rectangle(out, (cx - half_w, chin + 60), (cx + half_w, bottom), 1, -1)
    out = cv2.dilate(out, _ellipse(out.shape, 4))
    out[head > 0] = 0
    return out


def reach_region(spec: Torso | Body, visible: np.ndarray, bottom: int) -> np.ndarray:
    """Where the hidden body may be adopted from, unclipped, without the
    visible pixels: a torso hanging from a head, or a margin around a body
    plus its silhouette extruded to the floor row."""
    if isinstance(spec, Torso):
        return torso(visible, spec.half_w, bottom)
    out = (cv2.dilate(visible, _ellipse(visible.shape, spec.reach)) | extrude_down(visible, bottom)).astype(np.uint8)
    out[visible > 0] = 0
    return out


def hole_region(spec: Torso | Body, visible: np.ndarray, bottom: int, occluded: np.ndarray) -> np.ndarray:
    """The shape handed to the inpainter. A torso is compact already; a body's
    margin is wider than its reach but only where it runs toward its
    occluders — repainting wall or neighbours' heads that get discarded
    anyway only costs time and context."""
    if isinstance(spec, Torso):
        return torso(visible, spec.half_w, bottom)
    near_occluders = cv2.dilate(occluded, _ellipse(occluded.shape, spec.hole_reach // 2))
    ring = cv2.dilate(visible, _ellipse(visible.shape, spec.hole_reach)) & near_occluders
    out = (ring | extrude_down(visible, bottom)).astype(np.uint8)
    out[visible > 0] = 0
    return out


def occluders(i: int, reach: np.ndarray, masks: dict[int, np.ndarray], z: dict[int, float]) -> list[int]:
    """Figures in front of `i` whose pixels the adopted margin runs under."""
    return sorted(j for j, m in masks.items()
                  if j != i and z[j] > z[i] and int((reach & m).sum()) >= MIN_OVERLAP)


def union(js: list[int], masks: dict[int, np.ndarray], shape: tuple[int, int]) -> np.ndarray:
    out = np.zeros(shape, np.uint8)
    for j in js:
        out |= masks[j].astype(np.uint8)
    return out


def keep_region(reach: np.ndarray, occl: list[int], masks: dict[int, np.ndarray]) -> np.ndarray:
    """The adopted part of the extension: reach ∩ the occluders' pixels."""
    return reach & union(occl, masks, reach.shape)


def completed_z(z: dict[int, float], occl: dict[int, list[int]],
                step: float = STEP_BEHIND, floor: float | None = None) -> dict[int, float]:
    """Each completed figure a `step` behind its nearest occluder. Occluders
    may themselves be completed (and move back), so iterate to a fixed point
    — z only ever decreases, so it terminates."""
    out = dict(z)
    for _ in range(len(out) + 1):
        changed = False
        for i, js in occl.items():
            if not js:
                continue
            want = round(min(out[j] for j in js) - step, 2)
            if floor is not None:
                want = max(floor, want)
            if out[i] != want:
                out[i] = want
                changed = True
        if not changed:
            break
    return out


def crop_rect(mask: np.ndarray, pad: int = 16) -> tuple[int, int, int, int]:
    """(x0, y0, w, h) of the mask's bounding box, padded, inside the image."""
    H, W = mask.shape
    ys, xs = np.nonzero(mask)
    x0, x1 = max(int(xs.min()) - pad, 0), min(int(xs.max()) + pad + 1, W)
    y0, y1 = max(int(ys.min()) - pad, 0), min(int(ys.max()) + pad + 1, H)
    return x0, y0, x1 - x0, y1 - y0
