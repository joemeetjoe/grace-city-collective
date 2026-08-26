"""Tests for the depth-bake post-processing (bake_depth.py).

Covers the pure numpy/PIL stages only — model inference (run_model) is
exercised by running the real bake, not unit tests.

Usage: .venv-recut/bin/python -m pytest tools/recut/test_bake_depth.py
"""

import numpy as np

from bake_depth import make_qc_overlay, normalize_depth, smooth_depth, to_texture


def test_normalize_depth_maps_range_to_unit_interval():
    raw = np.array([[2.0, 6.0], [10.0, 4.0]], dtype=np.float32)

    out = normalize_depth(raw)

    assert out.min() == 0.0
    assert out.max() == 1.0
    np.testing.assert_allclose(out, (raw - 2.0) / 8.0)


def test_normalize_depth_constant_input_returns_zeros():
    raw = np.full((4, 4), 7.0, dtype=np.float32)

    out = normalize_depth(raw)

    assert np.isfinite(out).all()
    np.testing.assert_array_equal(out, np.zeros((4, 4), dtype=np.float32))


def test_smooth_depth_spreads_a_spike_but_preserves_broad_gradient():
    spike = np.zeros((64, 64), dtype=np.float32)
    spike[32, 32] = 1.0

    out = smooth_depth(spike, sigma_px=8)

    assert out[32, 32] < 0.05  # per-stroke noise is flattened
    assert out.sum() > 0.9  # energy spreads, not erased (border loss aside)
    assert out.shape == spike.shape

    # a broad left-to-right ramp survives smoothing nearly unchanged
    ramp = np.tile(np.linspace(0.0, 1.0, 64, dtype=np.float32), (64, 1))
    smoothed_ramp = smooth_depth(ramp, sigma_px=8)
    center = smoothed_ramp[16:48, 16:48]
    np.testing.assert_allclose(center, ramp[16:48, 16:48], atol=0.02)


def test_to_texture_emits_greyscale_image_at_mask_resolution():
    depth01 = np.tile(np.linspace(0.0, 1.0, 2048, dtype=np.float32), (2519, 1))

    img = to_texture(depth01)

    assert img.mode == "L"
    assert img.size == (1024, 1260)  # matches the cut masks
    px = np.asarray(img)
    assert px[:, 0].mean() < 5  # far edge stays dark
    assert px[:, -1].mean() > 250  # near edge stays bright


def test_make_qc_overlay_tints_near_and_far_differently():
    depth01 = np.tile(np.linspace(0.0, 1.0, 128, dtype=np.float32), (128, 1))
    plate = np.full((128, 128, 3), 128, dtype=np.uint8)

    overlay = make_qc_overlay(depth01, plate)

    assert overlay.shape == (128, 128, 3)
    assert overlay.dtype == np.uint8
    far_tint = overlay[:, 0].mean(axis=0)
    near_tint = overlay[:, -1].mean(axis=0)
    assert np.abs(far_tint - near_tint).max() > 30  # tints are distinguishable
