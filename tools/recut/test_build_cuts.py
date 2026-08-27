"""Tests for the crowd disocclusion fill (build_cuts.py).

Covers the pure numpy stages of the crowd map/alpha synthesis — mask loading
and the full pipeline run are exercised by running the real build.

Usage: .venv-recut/bin/python -m pytest tools/recut/test_build_cuts.py
"""

import cv2
import numpy as np

import pytest

from build_cuts import FIG_Z, band_alpha, build_manifest, figure_z, merge_figures, synth_crowd_map


def crowd_scene() -> tuple[np.ndarray, np.ndarray, tuple[int, int, int, int]]:
    """A synthetic plate: mid-grey ground with a hatched 'crowd' texture, a
    figure-shaped hole in the middle, and a clean sample patch on the left."""
    rng = np.random.default_rng(7)
    H, W = 300, 360
    plate = np.full((H, W, 3), 128, np.float32)
    hatch = 128 + 40 * np.sign(np.sin(np.arange(W) * 1.3))[None, :, None]
    plate[:] = hatch + rng.normal(0, 4, (H, W, 3))
    plate = plate.clip(0, 255).astype(np.uint8)
    hole = np.zeros((H, W), np.uint8)
    hole[60:240, 140:260] = 1
    patch_box = (40, 200, 20, 120)  # y0, y1, x0, x1 — clean crowd texture
    return plate, hole, patch_box


def hole_depth() -> np.ndarray:
    """Distance into crowd_scene's rectangular hole, 0 outside it."""
    rr, cc = np.mgrid[0:300, 0:360].astype(np.float32)
    d = np.minimum.reduce([rr - 60 + 1, 240 - rr, cc - 140 + 1, 260 - cc])
    return np.where(d > 0, d, 0)


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
    clear = np.ones_like(hole)
    clear[55:245, 135:265] = 0  # everything 5+ px away from the hole
    np.testing.assert_array_equal(out[clear == 1], plate[clear == 1])


def test_synth_crowd_map_fill_matches_the_surrounding_tone():
    plate, hole, patch_box = crowd_scene()
    y0, y1, x0, x1 = patch_box
    patch = plate[y0:y1, x0:x1].astype(np.float32)

    out = synth_crowd_map(plate, hole, patch_box).astype(np.float32)

    deep = np.zeros_like(hole)
    deep[105:195, 185:215] = 1  # hole eroded past any boundary treatment
    ratio = out[deep == 1].mean() / plate[hole == 0].mean()
    assert 0.95 < ratio < 1.05  # the wall simply continues — no shadow
    # the hatch keeps its contrast: a flattened fill reads as a smudge
    assert 0.75 * patch.std() < out[deep == 1].std() < 1.25 * patch.std()


def test_synth_crowd_map_fill_brightness_tracks_the_local_surroundings():
    plate, hole, patch_box = crowd_scene()
    lit = plate.astype(np.float32)
    lit[:, 120:280] += 70  # a beam of light around the hole, patch region unlit
    lit = lit.clip(0, 255).astype(np.uint8)

    out = synth_crowd_map(lit, hole, patch_box).astype(np.float32)

    deep = np.zeros_like(hole)
    deep[105:195, 185:215] = 1
    surround = lit[:, 120:280][hole[:, 120:280] == 0].mean()
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
    # keyed by source index: a merged-away figure leaves a gap in the numbering
    cuts = build_manifest(fig_z={0: 1.2, 3: -0.5}, flame_count=4)

    by_name = {c["name"]: c for c in cuts}
    assert by_name["fig0"] == {"name": "fig0", "z": 1.2, "isFlame": 0, "relief": 1}
    assert by_name["fig3"]["z"] == -0.5
    assert "fig1" not in by_name
    assert by_name["flame3"]["isFlame"] == 1
    assert by_name["crowd"]["map"] == "map-crowd.jpg"
    assert {"dove", "arch", "floor"} <= set(by_name)
    assert [c["name"] for c in cuts if "map" in c] == ["crowd"]


def test_synth_crowd_map_fill_carries_no_ghost_of_the_hole_content():
    plate, hole, patch_box = crowd_scene()
    ghost = plate.copy()
    ghost[hole == 1] = 255  # a bright 'figure' filling its own hole

    out = synth_crowd_map(ghost, hole, patch_box).astype(np.float32)

    inner = hole.copy()
    inner[:] = 0
    inner[62:238, 142:258] = 1  # hole eroded 2 px
    assert out[inner == 1].max() < 200  # nothing of the figure bleeds into the fill


def test_synth_crowd_map_fill_has_no_brightness_step_at_any_depth():
    plate, hole, patch_box = crowd_scene()

    out = synth_crowd_map(plate, hole, patch_box).astype(np.float32)

    d = hole_depth()
    surround = plate[hole == 0].mean()
    ring = (d >= 8) & (d <= 12)
    deep = d >= 45
    # the same tone just inside the boundary and deep inside: nothing traces
    # the silhouette, nothing pools into a shadow at the centre
    assert 0.95 * surround < out[ring].mean() < 1.05 * surround
    assert 0.95 * surround < out[deep].mean() < 1.05 * surround


def test_synth_crowd_map_consumes_mask_edge_slivers_around_the_hole():
    # the plate's engraved rim highlights often sit a pixel or two OUTSIDE the
    # segmentation mask; left in the crowd they trace the figure's outline as
    # it slides, so the fill must swallow a thin shell around the hole
    plate, hole, patch_box = crowd_scene()
    ring = np.zeros_like(hole)
    ring[58:242, 138:262] = 1
    ring[hole == 1] = 0  # 1-2 px shell just outside the hole
    rimmed = plate.copy()
    rimmed[ring == 1] = 255

    out = synth_crowd_map(rimmed, hole, patch_box).astype(np.float32)

    assert out[ring == 1].max() < 200


def square_masks() -> list[np.ndarray]:
    """Three disjoint 2x2 blocks on a 4x6 canvas, one per figure."""
    masks = []
    for x in (0, 2, 4):
        m = np.zeros((4, 6), np.uint8)
        m[1:3, x:x + 2] = 1
        masks.append(m)
    return masks


def test_merge_figures_unions_child_into_parent_and_drops_child():
    masks = square_masks()

    out = merge_figures(masks, {1: 2})

    assert sorted(out) == [0, 2]  # survivors keep their source index
    np.testing.assert_array_equal(out[0], masks[0])
    np.testing.assert_array_equal(out[2], masks[1] | masks[2])
    np.testing.assert_array_equal(masks[2], square_masks()[2])  # inputs untouched


def test_merge_figures_rejects_unknown_or_self_merges():
    masks = square_masks()

    with pytest.raises(KeyError):
        merge_figures(masks, {1: 7})
    with pytest.raises(ValueError):
        merge_figures(masks, {1: 1})


def test_synth_crowd_map_deep_fill_matches_open_wall_not_the_halo_around_the_figure():
    # Doré darkens the wall in a ~60px halo around every figure; the fill must
    # match the open wall beyond it, or it reads as a dark cloud once the
    # figure has moved off it
    plate, hole, patch_box = crowd_scene()
    d_out = cv2.distanceTransform((1 - hole).astype(np.uint8), cv2.DIST_L2, 3)
    haloed = plate.astype(np.float32)
    haloed[(d_out > 0) & (d_out < 40)] *= 0.75
    haloed = haloed.clip(0, 255).astype(np.uint8)

    out = synth_crowd_map(haloed, hole, patch_box).astype(np.float32)

    far = haloed[d_out > 70].mean()
    deep = out[hole_depth() >= 45].mean()
    assert haloed[(d_out > 5) & (d_out < 35)].mean() < 0.85 * far  # the halo is real
    assert 0.95 * far < deep < 1.05 * far


def test_figure_z_maps_lowest_row_onto_the_z_range_and_applies_overrides():
    bottoms = {0: 0.60, 3: 0.80, 7: 0.70}

    z = figure_z(bottoms, override={7: 1.4, 99: 0.0})

    assert z[0] == FIG_Z[0]  # highest bottom row -> backmost
    assert z[3] == FIG_Z[1]  # lowest bottom row -> frontmost
    assert z[7] == 1.4  # override wins over the interpolated midpoint
    assert 99 not in z  # overrides for absent figures are ignored
