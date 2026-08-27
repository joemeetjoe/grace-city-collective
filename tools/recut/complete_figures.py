"""Generate the hidden bodies of occluded figures (issue #20).

Reads the holes build_cuts.py wrote to dist/complete/fig<N>-hole.png (run it
first), inpaints each with SDXL-inpainting on a 1024px crop, and writes
candidates for a human to pick from. The picks, tone-matched to the plate
and given their own depth, are written back for build_cuts.py to adopt.

  --generate [figs]   dist/complete/candidates/fig<N>-seed<K>.png
                      dist/complete/sheet-fig<N>.jpg   plate | hole | seeds…
  --pick              reads completion_picks.json ({"6": 2, "12": 0, …}):
                      dist/complete/fig<N>-gen.png     plate with the pick
                                                       pasted in, tone-matched
                      dist/complete/fig<N>-depth.png   depth of the completed
                                                       figure (Depth Anything,
                                                       aligned to depth.png)
Then rerun build_cuts.py, which crops map-fig<N>.jpg / depth-fig<N>.png to
the figure and adds them to cuts.json.

~5-7 min per candidate on Apple silicon (MPS, fp16); weights (~6 GB) cache
under ~/.cache/huggingface.

Usage:
  .venv-recut/bin/python tools/recut/complete_figures.py --generate [6 12 …] [--seeds 3]
  .venv-recut/bin/python tools/recut/complete_figures.py --pick
"""

import argparse
import json
import time
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

import build_cuts as bc
import completions as comp

HERE = Path(__file__).resolve().parent
DIST = bc.DIST
COMP = DIST / "complete"
CAND = COMP / "candidates"
PICKS = HERE / "completion_picks.json"
MODEL = "diffusers/stable-diffusion-xl-1.0-inpainting-0.1"
CROP = 1024

STYLE = ("black and white wood engraving by Gustave Doré, 19th century bible "
         "illustration, fine parallel hatching lines, dramatic chiaroscuro, ")
NEGATIVE = ("photograph, color, painting, blurry, smooth shading, airbrushed, "
            "modern, text, watermark, extra heads, deformed")
PROMPT = {
    "torso": STYLE + "a man in a long robe standing with his head bowed in prayer, "
                     "full body, hands folded",
    "body": STYLE + "the lower body and robe of a standing figure, folds of heavy cloth "
                    "falling to the floor",
}


def load_mask(path: Path) -> np.ndarray:
    return (np.asarray(Image.open(path).convert("L")) > 127).astype(np.uint8)


def crop_origin(region: np.ndarray, size: int) -> tuple[int, int]:
    H, W = region.shape
    ys, xs = np.nonzero(region)
    cx, cy = int(xs.mean()), int((ys.min() + ys.max()) / 2)
    return min(max(cy - size // 2, 0), H - size), min(max(cx - size // 2, 0), W - size)


def load_pipe():
    import torch
    from diffusers import AutoPipelineForInpainting
    pipe = AutoPipelineForInpainting.from_pretrained(MODEL, torch_dtype=torch.float16, variant="fp16")
    pipe.to("mps")
    pipe.enable_attention_slicing()
    pipe.vae.enable_slicing()
    return pipe


def generate(figs: list[int], seeds: int, steps: int) -> None:
    import torch
    plate = np.asarray(Image.open(bc.PLATE).convert("RGB"))
    CAND.mkdir(parents=True, exist_ok=True)
    pipe = None
    for i in figs:
        hole_path = COMP / f"fig{i}-hole.png"
        if not hole_path.exists():
            print(f"fig{i}: no dist/complete/fig{i}-hole.png — run build_cuts.py first")
            continue
        hole = load_mask(hole_path)
        vis = (np.asarray(Image.open(DIST / f"cut-fig{i}.png").convert("L").resize(hole.shape[::-1])) > 127)
        y0, x0 = crop_origin(hole | vis, CROP)
        crop = plate[y0:y0 + CROP, x0:x0 + CROP]
        mask = hole[y0:y0 + CROP, x0:x0 + CROP]
        if hole.sum() != mask.sum():
            print(f"fig{i}: hole does not fit a {CROP}px crop, clipping {int(hole.sum() - mask.sum())}px")
        kind = "torso" if isinstance(comp.SPEC[i], comp.Torso) else "body"
        print(f"fig{i} ({kind}): hole {int(mask.sum())}px, crop origin ({y0},{x0})", flush=True)
        shown = crop.copy()
        shown[mask > 0] = (shown[mask > 0] * 0.35 + np.array([200, 60, 60]) * 0.65).astype(np.uint8)
        panels = [crop, shown]
        if pipe is None:
            pipe = load_pipe()
        for seed in range(seeds):
            t = time.time()
            out = pipe(
                prompt=PROMPT[kind], negative_prompt=NEGATIVE,
                image=Image.fromarray(crop), mask_image=Image.fromarray(mask * 255),
                num_inference_steps=steps, guidance_scale=7.5, strength=0.99,
                generator=torch.Generator("cpu").manual_seed(1000 + seed),
                width=CROP, height=CROP,
            ).images[0]
            res = np.where(mask[..., None] > 0, np.asarray(out.convert("RGB")), crop)
            Image.fromarray(res).save(CAND / f"fig{i}-seed{seed}.png")
            json.dump({"y0": y0, "x0": x0}, open(CAND / f"fig{i}-origin.json", "w"))
            panels.append(res)
            print(f"  seed {seed}: {time.time() - t:.0f}s", flush=True)
        gap = np.full((CROP, 8, 3), 255, np.uint8)
        sheet = panels[0]
        for p in panels[1:]:
            sheet = np.concatenate([sheet, gap, p], axis=1)
        Image.fromarray(sheet).resize((sheet.shape[1] // 2, CROP // 2), Image.LANCZOS).save(
            COMP / f"sheet-fig{i}.jpg", quality=88)
        print(f"  wrote dist/complete/sheet-fig{i}.jpg", flush=True)


def tone_match(plate: np.ndarray, gen: np.ndarray, hole: np.ndarray) -> np.ndarray:
    """Scale the generated pixels so their low-frequency brightness follows
    the plate's around the hole (the same guide the wall fill uses), and
    ramp that correction in from the hole boundary so no step appears."""
    img = plate.astype(np.float32)
    target = bc.brightness_field(img, hole)
    g = gen.astype(np.float32)
    g_lum = cv2.GaussianBlur(g.mean(axis=2), (0, 0), 30)
    gain = np.clip(target / (g_lum + 1e-4), 0.5, 1.8)
    out = g * gain[..., None]
    return np.where(hole[..., None] > 0, out, img).clip(0, 255).astype(np.uint8)


def pick() -> None:
    from bake_depth import normalize_depth, run_model, smooth_depth
    picks = {int(k): int(v) for k, v in json.load(open(PICKS)).items()}
    plate = np.asarray(Image.open(bc.PLATE).convert("RGB"))
    H, W, _ = plate.shape
    plate_depth = np.asarray(Image.open(DIST / "depth.png").convert("L").resize((W, H))).astype(np.float32) / 255
    for i, seed in sorted(picks.items()):
        cand = CAND / f"fig{i}-seed{seed}.png"
        origin = json.load(open(CAND / f"fig{i}-origin.json"))
        y0, x0 = origin["y0"], origin["x0"]
        hole = load_mask(COMP / f"fig{i}-hole.png")
        gen_full = plate.copy()
        gen_full[y0:y0 + CROP, x0:x0 + CROP] = np.asarray(Image.open(cand).convert("RGB"))
        gen_full = tone_match(plate, gen_full, hole)
        Image.fromarray(gen_full).save(COMP / f"fig{i}-gen.png", optimize=True)

        # depth of the completed figure: Depth Anything on the completed crop,
        # then a linear fit onto the plate's depth over the visible pixels so
        # the relief sits at the same level as before
        keep = load_mask(COMP / f"fig{i}-keep.png")
        vis = (np.asarray(Image.open(DIST / f"cut-fig{i}.png").convert("L").resize((W, H))) > 127)
        crop = Image.fromarray(gen_full[y0:y0 + CROP, x0:x0 + CROP])
        d = smooth_depth(normalize_depth(run_model(crop)))
        v = vis[y0:y0 + CROP, x0:x0 + CROP]
        ref = plate_depth[y0:y0 + CROP, x0:x0 + CROP]
        a, b = np.polyfit(d[v], ref[v], 1) if v.sum() > 100 else (1.0, 0.0)
        aligned = np.clip(a * d + b, 0, 1)
        depth_full = plate_depth.copy()
        region = (keep | vis.astype(np.uint8))[y0:y0 + CROP, x0:x0 + CROP] > 0
        sub = depth_full[y0:y0 + CROP, x0:x0 + CROP]
        sub[region] = aligned[region]
        Image.fromarray((depth_full * 255).astype(np.uint8)).save(COMP / f"fig{i}-depth.png", optimize=True)
        print(f"fig{i}: seed {seed} adopted (depth fit {a:.2f}·d + {b:.2f}), wrote fig{i}-gen.png / fig{i}-depth.png")
    print("now rerun build_cuts.py")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--generate", nargs="*", type=int, metavar="FIG")
    ap.add_argument("--seeds", type=int, default=3)
    ap.add_argument("--steps", type=int, default=30)
    ap.add_argument("--pick", action="store_true")
    args = ap.parse_args()
    if args.generate is not None:
        figs = args.generate or sorted(comp.SPEC)
        generate(figs, args.seeds, args.steps)
    if args.pick:
        pick()


if __name__ == "__main__":
    main()
