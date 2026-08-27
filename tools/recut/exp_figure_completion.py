"""Experiment for issue #20: can a diffusion inpainter invent the hidden body
of a figure that stands behind another, in Doré's line?

Two cases (heads SAM cut apart from their bodies, currently merged into the
figure in front of them by FIG_MERGE):
  A  bearded head between Mary's veil and the praying man (person-06)
  D  small head above the bowing man's back (person-12)

For each: a torso-shaped hole is drawn below the head over whatever occludes
it, a 1024px crop around it is inpainted with SDXL-inpainting (fp16, MPS),
and the results are laid out for judgement:

  dist/exp-complete-<case>.png   crop | crop with the hole | result per seed
  dist/exp-complete-<case>-hole.png   the hole in plate coordinates
  dist/exp-complete-<case>-seed<N>.png   the inpainted crop

This only produces pictures to look at. Wiring a completed figure into the
cut set (own colour map, own depth for relief — see the note on #20) is the
next step, and only if the pictures earn it.

Usage: .venv-recut/bin/python tools/recut/exp_figure_completion.py [A|D] [--steps 30] [--seeds 2]
"""

import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PLATE = ROOT / "public" / "dore" / "plate.jpg"
DIST = HERE / "dist"
MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
CROP = 1024

STYLE = ("black and white wood engraving by Gustave Doré, 19th century bible "
         "illustration, fine parallel hatching lines, dramatic chiaroscuro, ")
NEGATIVE = ("photograph, color, painting, blurry, smooth shading, airbrushed, "
            "modern, text, watermark, extra heads, deformed")

CASES = {
    "A": dict(
        head="person-06",
        # torso extent below the chin, plate px: half-width, bottom row
        half_w=170, bottom=1900,
        prompt=STYLE + "a bearded man in a long robe standing with his head bowed "
                       "in prayer, hands folded, full body, seen from the side",
    ),
    "D": dict(
        head="person-12",
        half_w=95, bottom=1620,
        prompt=STYLE + "a man in a robe standing behind others with his head bowed, "
                       "shoulders and chest, upper body",
    ),
}


def torso_hole(head: np.ndarray, half_w: int, bottom: int) -> np.ndarray:
    """A shoulders-and-torso silhouette hanging from the head: an ellipse for
    the shoulders, a rectangle below, minus the head itself."""
    H, W = head.shape
    ys, xs = np.nonzero(head)
    cx, chin = int(xs.mean()), int(ys.max())
    hole = np.zeros((H, W), np.uint8)
    cv2.ellipse(hole, (cx, chin + 60), (half_w, 90), 0, 0, 360, 1, -1)
    cv2.rectangle(hole, (cx - half_w, chin + 60), (cx + half_w, bottom), 1, -1)
    hole[head > 0] = 0
    # a small margin below the chin so the neck joins the invented body
    hole = cv2.dilate(hole, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9)))
    hole[head > 0] = 0
    return hole


def crop_box(hole: np.ndarray, head: np.ndarray, size: int) -> tuple[int, int]:
    """Top-left of a size x size crop centred on the head+hole, inside the plate."""
    H, W = hole.shape
    ys, xs = np.nonzero(hole | head)
    cx, cy = int(xs.mean()), int((ys.min() + ys.max()) / 2)
    x0 = min(max(cx - size // 2, 0), W - size)
    y0 = min(max(cy - size // 2, 0), H - size)
    return y0, x0


def load_pipe():
    import torch
    from diffusers import AutoPipelineForInpainting
    pipe = AutoPipelineForInpainting.from_pretrained(MODEL, torch_dtype=torch.float16, variant="fp16")
    pipe.to("mps")
    pipe.enable_attention_slicing()
    pipe.vae.enable_slicing()
    return pipe


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("cases", nargs="*", default=list(CASES))
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--seeds", type=int, default=2)
    ap.add_argument("--guidance", type=float, default=7.5)
    args = ap.parse_args()

    plate = np.asarray(Image.open(PLATE).convert("RGB"))
    H, W, _ = plate.shape
    pipe = None
    for case in args.cases:
        c = CASES[case]
        head = (np.asarray(Image.open(HERE / "out-person" / f"{c['head']}.png").convert("L")) > 127).astype(np.uint8)
        hole = torso_hole(head, c["half_w"], c["bottom"])
        Image.fromarray(hole * 255).save(DIST / f"exp-complete-{case}-hole.png")
        y0, x0 = crop_box(hole, head, CROP)
        crop = plate[y0:y0 + CROP, x0:x0 + CROP]
        mask = hole[y0:y0 + CROP, x0:x0 + CROP]
        print(f"case {case}: hole {int(hole.sum())}px, crop origin ({y0},{x0})", flush=True)

        shown = crop.copy()
        shown[mask > 0] = (shown[mask > 0] * 0.35 + np.array([200, 60, 60]) * 0.65).astype(np.uint8)
        panels = [crop, shown]

        if pipe is None:
            t = time.time()
            pipe = load_pipe()
            print(f"pipeline ready in {time.time() - t:.0f}s", flush=True)
        import torch
        for seed in range(args.seeds):
            t = time.time()
            out = pipe(
                prompt=c["prompt"], negative_prompt=NEGATIVE,
                image=Image.fromarray(crop), mask_image=Image.fromarray(mask * 255),
                num_inference_steps=args.steps, guidance_scale=args.guidance, strength=0.99,
                generator=torch.Generator("cpu").manual_seed(1000 + seed),
                width=CROP, height=CROP,
            ).images[0]
            res = np.asarray(out.convert("RGB"))
            # the pipeline re-encodes the whole crop through the VAE; keep the
            # plate's own pixels everywhere outside the hole
            res = np.where(mask[..., None] > 0, res, crop)
            Image.fromarray(res).save(DIST / f"exp-complete-{case}-seed{seed}.png")
            panels.append(res)
            print(f"  seed {seed}: {time.time() - t:.0f}s  mean lum in hole {res[mask > 0].mean():.0f} "
                  f"(plate around: {crop[mask == 0].mean():.0f})", flush=True)

        gap = np.full((CROP, 8, 3), 255, np.uint8)
        side = panels[0]
        for p in panels[1:]:
            side = np.concatenate([side, gap, p], axis=1)
        Image.fromarray(side).save(DIST / f"exp-complete-{case}.png")
        print(f"  wrote dist/exp-complete-{case}.png", flush=True)


if __name__ == "__main__":
    sys.exit(main())
