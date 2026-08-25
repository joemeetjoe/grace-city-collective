"""Grounded-SAM fallback while facebook/sam3 access is pending review.

Grounding DINO (ungated) detects instances from a text prompt; SAM 2.1
(ungated) converts each detection box to a precise silhouette mask. Writes,
into tools/recut/out/: one raw mask PNG per instance plus overlay.png with
every instance tinted a different color.

Usage:
  .venv-recut/bin/python tools/recut/segment_grounded.py [prompt] [box_thresh]
  (defaults: "person" 0.3 — DINO wants lowercase prompts ending in ".")
"""

import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from transformers import (
    AutoModelForZeroShotObjectDetection,
    AutoProcessor,
    Sam2Model,
    Sam2Processor,
)

ROOT = Path(__file__).resolve().parents[2]
PLATE = ROOT / "Parallax Scrolling Photo Layers" / "assets" / "dore-pentecost-dark-2048.jpg"
OUT = Path(__file__).resolve().parent / "out"

DINO = "IDEA-Research/grounding-dino-base"
SAM2 = "facebook/sam2.1-hiera-large"

PROMPT = sys.argv[1] if len(sys.argv) > 1 else "person"
BOX_THRESHOLD = float(sys.argv[2]) if len(sys.argv) > 2 else 0.3

TINTS = [
    (255, 60, 60), (60, 200, 255), (90, 255, 120), (255, 200, 40),
    (200, 90, 255), (255, 120, 190), (120, 140, 255), (255, 150, 60),
    (60, 255, 220), (230, 230, 90), (160, 255, 60), (255, 80, 120),
]


def main() -> None:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    image = Image.open(PLATE).convert("RGB")
    print(f"device={device}  prompt={PROMPT!r}  box_threshold={BOX_THRESHOLD}")
    print(f"plate {image.size[0]}x{image.size[1]}")

    # --- stage 1: text -> boxes ---
    dino_processor = AutoProcessor.from_pretrained(DINO)
    dino = AutoModelForZeroShotObjectDetection.from_pretrained(DINO).to(device)
    text = PROMPT.lower().rstrip(".") + "."
    inputs = dino_processor(images=image, text=text, return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = dino(**inputs)
    detections = dino_processor.post_process_grounded_object_detection(
        outputs,
        inputs.input_ids,
        threshold=BOX_THRESHOLD,
        text_threshold=0.25,
        target_sizes=[image.size[::-1]],
    )[0]
    boxes = detections["boxes"].cpu().tolist()
    print(f"{len(boxes)} boxes")
    for i, (b, s) in enumerate(zip(boxes, detections["scores"].cpu().tolist())):
        print(f"  [{i:2d}] score={s:.3f} box={[round(v) for v in b]}")
    if not boxes:
        print("nothing detected — try a lower threshold or a different prompt")
        return
    del dino
    if device == "mps":
        torch.mps.empty_cache()

    # --- stage 2: boxes -> masks ---
    sam_processor = Sam2Processor.from_pretrained(SAM2)
    sam = Sam2Model.from_pretrained(SAM2).to(device)
    inputs = sam_processor(images=image, input_boxes=[boxes], return_tensors="pt").to(device)
    with torch.no_grad():
        outputs = sam(**inputs, multimask_output=False)
    masks = sam_processor.post_process_masks(outputs.pred_masks.cpu(), inputs["original_sizes"])[0]
    masks = masks.squeeze(1).numpy().astype(np.uint8)  # (n, H, W)

    OUT.mkdir(parents=True, exist_ok=True)
    base = np.asarray(image, dtype=np.float32)
    overlay = base * 0.45
    stem = PROMPT.replace(" ", "_")
    for i, m in enumerate(masks):
        print(f"  [{i:2d}] mask area={int(m.sum())}px")
        Image.fromarray(m * 255, mode="L").save(OUT / f"{stem}-{i:02d}.png")
        tint = np.array(TINTS[i % len(TINTS)], dtype=np.float32)
        overlay[m > 0] = base[m > 0] * 0.35 + tint * 0.65

    Image.fromarray(overlay.clip(0, 255).astype(np.uint8)).save(OUT / "overlay.png")
    print(f"wrote {OUT}/overlay.png")


if __name__ == "__main__":
    main()
