"""Bake a smoothed monocular depth map of the Doré plate.

Runs Depth Anything V2 Small over the full plate, normalizes to 0-1
(1.0 = nearest — the model emits disparity-like values, higher = closer),
Gaussian-smooths at plate resolution so cross-hatched linework doesn't
read as per-stroke depth, and emits the texture at mask resolution.

Inputs:
  public/dore/plate.jpg   the 2048x2519 working plate

Outputs, in tools/recut/dist/:
  depth.png     single-channel depth texture, 1024px wide (white = near)
  qc-depth.png  depth tinted over the dimmed plate, for eyeballing ordering

The model (~100 MB) is downloaded once into the default Hugging Face
cache (~/.cache/huggingface/hub); reruns load from cache.

Usage: .venv-recut/bin/python tools/recut/bake_depth.py
"""

from pathlib import Path

import cv2
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
PLATE = ROOT / "public" / "dore" / "plate.jpg"
DIST = HERE / "dist"

MODEL_ID = "depth-anything/Depth-Anything-V2-Small-hf"
SMOOTH_SIGMA_PX = 8     # Gaussian sigma at plate resolution
OUT_W = 1024            # output texture width, same as the cut masks


def normalize_depth(arr: np.ndarray) -> np.ndarray:
    lo, hi = float(arr.min()), float(arr.max())
    if hi == lo:
        return np.zeros_like(arr)
    return (arr - lo) / (hi - lo)


def smooth_depth(arr: np.ndarray, sigma_px: float = SMOOTH_SIGMA_PX) -> np.ndarray:
    return cv2.GaussianBlur(arr, (0, 0), sigmaX=sigma_px, sigmaY=sigma_px)


def to_texture(depth01: np.ndarray, out_w: int = OUT_W) -> Image.Image:
    h, w = depth01.shape
    img = Image.fromarray((depth01 * 255).astype(np.uint8), mode="L")
    return img.resize((out_w, round(out_w * h / w)), Image.LANCZOS)


def make_qc_overlay(depth01: np.ndarray, plate_rgb: np.ndarray) -> np.ndarray:
    tint_bgr = cv2.applyColorMap((depth01 * 255).astype(np.uint8), cv2.COLORMAP_TURBO)
    tint = cv2.cvtColor(tint_bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
    return (plate_rgb.astype(np.float32) * 0.45 + tint * 0.55).astype(np.uint8)


def run_model(plate: Image.Image) -> np.ndarray:
    import torch
    from transformers import AutoImageProcessor, AutoModelForDepthEstimation

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"loading {MODEL_ID} on {device}")
    processor = AutoImageProcessor.from_pretrained(MODEL_ID)
    model = AutoModelForDepthEstimation.from_pretrained(MODEL_ID).to(device).eval()

    inputs = processor(images=plate, return_tensors="pt").to(device)
    with torch.no_grad():
        predicted = model(**inputs).predicted_depth  # (1, h', w'), higher = nearer
    depth = torch.nn.functional.interpolate(
        predicted.unsqueeze(1),
        size=(plate.height, plate.width),
        mode="bicubic",
        align_corners=False,
    )
    return depth.squeeze().float().cpu().numpy()


def main() -> None:
    DIST.mkdir(exist_ok=True)
    plate = Image.open(PLATE).convert("RGB")
    print(f"plate {plate.width}x{plate.height}")

    depth01 = smooth_depth(normalize_depth(run_model(plate)))

    texture = to_texture(depth01)
    texture.save(DIST / "depth.png", optimize=True)

    plate_small = np.asarray(plate.resize(texture.size, Image.LANCZOS))
    depth_small = np.asarray(texture).astype(np.float32) / 255.0
    Image.fromarray(make_qc_overlay(depth_small, plate_small)).save(DIST / "qc-depth.png")

    print(f"wrote {DIST / 'depth.png'} ({texture.width}x{texture.height}) and qc-depth.png")


if __name__ == "__main__":
    main()
