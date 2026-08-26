"""Tests for the crowd disocclusion fill (build_cuts.py).

Covers the pure numpy stages of the crowd map/alpha synthesis — mask loading
and the full pipeline run are exercised by running the real build.

Usage: .venv-recut/bin/python -m pytest tools/recut/test_build_cuts.py
"""

import numpy as np

from build_cuts import band_alpha, build_manifest, synth_crowd_map


def crowd_scene() -> tuple[np.ndarray, np.ndarray, tuple[int, int, int, int]]:
    """A synthetic plate: mid-grey ground with a hatched 'crowd' texture, a
    figure-shaped hole in the middle, and a clean sample patch on the left."""
    rng = np.random.default_rng(7)
    H, W = 160, 200
    plate = np.full((H, W, 3), 128, np.float32)
    hatch = 128 + 40 * np.sign(np.sin(np.arange(W) * 1.3))[None, :, None]
    plate[:] = hatch + rng.normal(0, 4, (H, W, 3))
    plate = plate.clip(0, 255).astype(np.uint8)
    hole = np.zeros((H, W), np.uint8)
    hole[40:120, 90:150] = 1
    patch_box = (30, 130, 10, 70)  # y0, y1, x0, x1 — clean crowd texture
    return plate, hole, patch_box


def test_band_alpha_is_solid_inside_zero_outside_with_feathered_edges():
    a = band_alpha((200, 40), top_frac=0.40, bottom_frac=0.815, feather_px=8)
    top, bottom = 80, 163  # int(200 * frac)

    assert a.shape == (200, 40)
    assert a.dtype == np.float32
    assert a[:top].max() == 0.0
    assert a[bottom:].max() == 0.0
    assert (a[top + 8 : bottom - 8] == 1.0).all()

    # edges ramp monotonically, no figure-shaped holes anywhere in the band
    col = a[:, 0]
    assert (np.diff(col[top : top + 9]) >= 0).all()
    assert (np.diff(col[bottom - 9 : bottom]) <= 0).all()
    assert col[top:bottom].min() > 0.0

    # the band is uniform across the width
    np.testing.assert_array_equal(a[:, 0], a[:, -1])


def test_synth_crowd_map_passes_plate_through_outside_the_holes():
    plate, hole, patch_box = crowd_scene()

    out = synth_crowd_map(plate, hole, patch_box)

    assert out.shape == plate.shape
    assert out.dtype == np.uint8
    np.testing.assert_array_equal(out[hole == 0], plate[hole == 0])


def test_synth_crowd_map_fill_is_darkened_lower_contrast_shadow_mass():
    plate, hole, patch_box = crowd_scene()
    y0, y1, x0, x1 = patch_box
    patch = plate[y0:y1, x0:x1].astype(np.float32)

    out = synth_crowd_map(plate, hole, patch_box).astype(np.float32)

    deep = np.zeros_like(hole)
    deep[52:108, 102:138] = 1  # hole eroded past the feather radius
    ratio = out[deep == 1].mean() / plate[hole == 0].mean()
    assert 0.65 < ratio < 0.85  # ~x0.75 shadow darkening
    assert out[deep == 1].std() < 0.75 * patch.std()  # contrast cut on top


def test_synth_crowd_map_fill_brightness_tracks_the_local_surroundings():
    plate, hole, patch_box = crowd_scene()
    lit = plate.astype(np.float32)
    lit[:, 80:170] += 70  # a beam of light around the hole, patch region unlit
    lit = lit.clip(0, 255).astype(np.uint8)

    out = synth_crowd_map(lit, hole, patch_box).astype(np.float32)

    deep = np.zeros_like(hole)
    deep[52:108, 102:138] = 1
    surround = lit[:, 80:170][hole[:, 80:170] == 0].mean()
    assert out[deep == 1].mean() > 0.65 * surround  # guided, not flat patch copy


def test_synth_crowd_map_tiles_blend_without_rectangular_seams():
    # a patch with a vertical gradient makes butt-jointed tile repeats show up
    # as a sawtooth; blended tiling must keep row-to-row jumps small
    H, W = 160, 200
    grad = np.tile(np.linspace(60, 190, H, dtype=np.float32)[:, None], (1, W))
    plate = np.repeat(grad[..., None], 3, axis=2).astype(np.uint8)
    hole = np.zeros((H, W), np.uint8)
    hole[40:120, 90:150] = 1
    patch_box = (30, 90, 10, 70)  # 60 px tall — several repeats span the hole

    out = synth_crowd_map(plate, hole, patch_box).astype(np.float32)

    deep = out[52:108, 102:138].mean(axis=(1, 2))
    assert np.abs(np.diff(deep)).max() < 10.0


def test_build_manifest_marks_only_the_crowd_with_a_map_texture():
    cuts = build_manifest(fig_z=[1.2, -0.5], flame_count=4)

    by_name = {c["name"]: c for c in cuts}
    assert by_name["fig0"] == {"name": "fig0", "z": 1.2, "isFlame": 0, "relief": 1}
    assert by_name["fig1"]["z"] == -0.5
    assert by_name["flame3"]["isFlame"] == 1
    assert by_name["crowd"]["map"] == "map-crowd.jpg"
    assert {"dove", "arch", "floor"} <= set(by_name)
    assert [c["name"] for c in cuts if "map" in c] == ["crowd"]
