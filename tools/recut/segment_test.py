"""Feasibility test: can SAM 3 find the figures in Doré's engraving?

Runs a text-prompted instance segmentation over the plate and writes, into
tools/recut/out/: one raw mask PNG per detected instance, plus overlay.png
with every instance tinted a different color for quick visual judgement.

Usage:
  .venv-recut/bin/python tools/recut/segment_test.py [prompt] [threshold]
  (defaults: "person" 0.5)
"""

import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import Sam3Model, Sam3Processor

ROOT = Path(__file__).resolve().parents[2]
PLATE = ROOT / "Parallax Scrolling Photo Layers" / "assets" / "dore-pentecost-dark-2048.jpg"
PROMPT = sys.argv[1] if len(sys.argv) > 1 else "person"
OUT = Path(__file__).resolve().parent / f"out-{PROMPT.replace(' ', '_')}"
THRESHOLD = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5

TINTS = [
    (255, 60, 60), (60, 200, 255), (90, 255, 120), (255, 200, 40),
    (200, 90, 255), (255, 120, 190), (120, 140, 255), (255, 150, 60),
    (60, 255, 220), (230, 230, 90), (160, 255, 60), (255, 80, 120),
]


def main() -> None:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"device={device}  prompt={PROMPT!r}  threshold={THRESHOLD}")

    model = Sam3Model.from_pretrained("facebook/sam3").to(device)
    processor = Sam3Processor.from_pretrained("facebook/sam3")

    image = Image.open(PLATE).convert("RGB")
    print(f"plate {image.size[0]}x{image.size[1]}")

    inputs = processor(images=image, text=PROMPT, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = model(**inputs)

    results = processor.post_process_instance_segmentation(
        outputs,
        threshold=THRESHOLD,
        mask_threshold=0.5,
        target_sizes=inputs.get("original_sizes").tolist(),
    )[0]

    masks = results["masks"]
    scores = results["scores"]
    print(f"{len(masks)} instances")

    OUT.mkdir(parents=True, exist_ok=True)
    base = np.asarray(image, dtype=np.float32)
    overlay = base * 0.45

    for i, (mask, score) in enumerate(zip(masks, scores)):
        m = mask.cpu().numpy().astype(np.uint8)
        area = int(m.sum())
        print(f"  [{i:2d}] score={float(score):.3f} area={area}px")
        Image.fromarray(m * 255, mode="L").save(OUT / f"{PROMPT.replace(' ', '_')}-{i:02d}.png")
        tint = np.array(TINTS[i % len(TINTS)], dtype=np.float32)
        overlay[m > 0] = base[m > 0] * 0.35 + tint * 0.65

    Image.fromarray(overlay.clip(0, 255).astype(np.uint8)).save(OUT / "overlay.png")
    print(f"wrote {OUT}/overlay.png")


if __name__ == "__main__":
    main()
