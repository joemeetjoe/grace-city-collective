"""Tests for the crowd disocclusion fill (build_cuts.py).

Covers the pure numpy stages of the crowd map/alpha synthesis — mask loading
and the full pipeline run are exercised by running the real build.

Usage: .venv-recut/bin/python -m pytest tools/recut/test_build_cuts.py
"""

import cv2
import numpy as np

import pytest

from build_cuts import (CROWD_Z, FIG_Z, assign_flame_parents, backdrop_hole, band_alpha, build_manifest,
                        crowd_alpha, decontaminate, erode_feather, feather, figure_z, flame_parent,
                        merge_figures, ring_mask, synth_crowd_map)
from dolly import BACKDROP_Z


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


def test_figure_z_maps_lowest_row_between_fixed_anchors_and_applies_overrides():
    bottoms = {0: 0.60, 3: 0.80, 7: 0.70}

    z = figure_z(bottoms, override={7: 1.4, 99: 0.0}, rows=(0.60, 0.80))

    assert z[0] == FIG_Z[0]  # at the back anchor row -> backmost
    assert z[3] == FIG_Z[1]  # at the front anchor row -> frontmost
    assert z[7] == 1.4  # override wins over the interpolated midpoint
    assert 99 not in z  # overrides for absent figures are ignored


def test_figure_z_of_one_figure_never_depends_on_which_others_exist():
    # the whole point of fixed anchors: dropping or merging a mask must not
    # rescale everyone else (issue #17)
    alone = figure_z({3: 0.75}, rows=(0.60, 0.80))
    crowd = figure_z({0: 0.55, 3: 0.75, 5: 0.95}, rows=(0.60, 0.80))

    assert alone[3] == crowd[3]
    assert crowd[0] == FIG_Z[0]  # beyond the back anchor: clamped, not extrapolated
    assert crowd[5] == FIG_Z[1]  # beyond the front anchor: clamped


def test_ring_mask_is_the_band_just_inside_the_hole_boundary():
    _, hole, _ = crowd_scene()

    ring = ring_mask(hole, ring_px=20)

    d = hole_depth()
    np.testing.assert_array_equal(ring == 1, (d > 0) & (d <= 20))
    assert ring[hole == 0].sum() == 0  # never touches the plate outside the hole
    assert ring[150, 200] == 0  # the deep interior is left to the base fill


def test_flame_parent_is_the_head_nearest_below_the_flame():
    # heads as (x, y) plate fractions of each figure's topmost pixel
    heads = {"fig2": (0.22, 0.48), "fig4": (0.18, 0.52), "fig5": (0.29, 0.46)}

    # just above fig4's head, a touch left of fig2's: the flame hangs over fig4
    assert flame_parent((0.185, 0.465), heads) == "fig4"
    # squarely over fig5
    assert flame_parent((0.30, 0.39), heads) == "fig5"


def test_flame_parent_falls_back_to_the_crowd():
    heads = {"fig0": (0.10, 0.48)}

    assert flame_parent((0.50, 0.40), heads) == "crowd"  # nothing under it
    assert flame_parent((0.10, 0.20), heads) == "crowd"  # fig0 is too far below
    assert flame_parent((0.10, 0.55), heads) == "crowd"  # fig0's head is above it
    assert flame_parent((0.10, 0.40), {}) == "crowd"


def flame_scene() -> tuple[dict[str, np.ndarray], dict[str, np.ndarray]]:
    """Two figures with heads at x 20 and 60 on a 100x100 canvas, and two
    small flames, one over each head."""
    figs, flames = {}, {}
    for name, x in (("fig0", 20), ("fig1", 60)):
        m = np.zeros((100, 100), np.uint8)
        m[50:90, x - 5:x + 5] = 1
        figs[name] = m
    for name, x in (("flame0", 21), ("flame1", 58)):
        m = np.zeros((100, 100), np.uint8)
        m[38:46, x - 1:x + 2] = 1
        flames[name] = m
    return flames, figs


def test_assign_flame_parents_binds_every_flame_and_applies_overrides():
    flames, figs = flame_scene()

    assert assign_flame_parents(flames, figs) == {"flame0": "fig0", "flame1": "fig1"}
    assert assign_flame_parents(flames, figs, {"flame1": "crowd"}) == {"flame0": "fig0", "flame1": "crowd"}
    assert assign_flame_parents(flames, figs, {"flame1": "fig0"})["flame1"] == "fig0"


def test_assign_flame_parents_rejects_overrides_naming_nothing_in_the_scene():
    flames, figs = flame_scene()

    with pytest.raises(KeyError):
        assign_flame_parents(flames, figs, {"flame9": "fig0"})
    with pytest.raises(KeyError):
        assign_flame_parents(flames, figs, {"flame0": "fig7"})


def test_build_manifest_writes_each_flames_parent():
    cuts = build_manifest(fig_z={0: 1.2}, flame_count=2, flame_parents={"flame0": "fig0", "flame1": "crowd"})

    by_name = {c["name"]: c for c in cuts}
    assert by_name["flame0"] == {"name": "flame0", "z": by_name["flame0"]["z"], "isFlame": 1, "parent": "fig0"}
    assert by_name["flame1"]["parent"] == "crowd"
    # a manifest built without parents binds every flame to the crowd
    assert all(c["parent"] == "crowd" for c in build_manifest({0: 1.2}, 3) if c["isFlame"])


def test_build_manifest_puts_the_crowd_on_the_wall_plane():
    # the wall behind the apostles is the wall above them: one plane, or its
    # band edge slides across the backdrop's hatching on every dolly (#29)
    cuts = build_manifest(fig_z={0: 1.2}, flame_count=2)

    by_name = {c["name"]: c for c in cuts}
    assert by_name["crowd"]["z"] == CROWD_Z == BACKDROP_Z
    assert all(c["z"] > CROWD_Z for c in cuts if c["name"] != "crowd")


def window_scene():
    H, W = 60, 20
    arch = np.zeros((H, W), np.float32)
    arch[10:40, 2:8] = 1.0  # reaches into the band
    alphas = {"arch": arch, "fig0": np.ones((H, W), np.float32)}
    return (H, W), alphas


def test_crowd_alpha_is_the_plain_band_when_nothing_sits_behind_it():
    shape, alphas = window_scene()
    cuts = [{"name": "arch", "z": -2.8}, {"name": "fig0", "z": 1.5}, {"name": "crowd", "z": -5.6}]

    a = crowd_alpha(shape, alphas, cuts, crowd_z=-5.6, band=(0.40, 0.815), feather_px=2)

    np.testing.assert_array_equal(a, band_alpha(shape, 0.40, 0.815, 2))


def test_crowd_alpha_keeps_a_window_for_every_cut_behind_the_crowd():
    shape, alphas = window_scene()
    cuts = [{"name": "arch", "z": -2.8}, {"name": "fig0", "z": 1.5}, {"name": "crowd", "z": -0.9}]

    a = crowd_alpha(shape, alphas, cuts, crowd_z=-0.9, band=(0.40, 0.815), feather_px=2)

    band = band_alpha(shape, 0.40, 0.815, 2)
    assert (a[24:40, 2:8] == 0).all()  # the arch's rows inside the band are a window
    np.testing.assert_array_equal(a[:, 10:], band[:, 10:])  # figures in front punch no hole


def disc(r: int = 30, size: int = 100) -> np.ndarray:
    """A solid disc of radius r centred on a size x size canvas."""
    yy, xx = np.mgrid[0:size, 0:size]
    return ((yy - size // 2) ** 2 + (xx - size // 2) ** 2 <= r * r).astype(np.uint8)


def test_erode_feather_shrinks_the_support_by_px_and_keeps_a_soft_ramp():
    m = disc()

    plain = feather(m, 6)
    eroded = erode_feather(m, px=2, feather_px=6)

    # the ramp starts px further in: the pixels the erosion threw away are gone
    # from the support, and roughly one perimeter's worth per px of erosion
    lost = int((plain > 0).sum() - (eroded > 0).sum())
    perimeter = 2 * np.pi * 30
    assert 1.5 * perimeter < lost < 2.5 * perimeter
    # still soft: a ramp of intermediate values, monotone from the edge in
    row = eroded[50, :50]
    assert ((row > 0) & (row < 1)).sum() >= 5
    assert (np.diff(row) >= 0).all()
    assert eroded[50, 50] == 1.0
    assert eroded.dtype == np.float32


def test_erode_feather_never_grows_past_the_mask_it_was_given():
    # partition of unity: every pixel is owned by exactly one layer, so an
    # eroded figure may only give pixels up (to the layer beneath), never
    # claim any it did not own
    m = disc()

    eroded = erode_feather(m, px=1, feather_px=6)

    assert eroded[m == 0].max() == 0.0
    assert (eroded <= feather(m, 6) + 1e-6).all()


def test_backdrop_hole_covers_every_owned_pixel_whatever_the_erosion():
    # what an eroded figure gives up must land on inpainted backdrop, never on
    # the plate's own pixels of that figure — so the hole is cut from the full
    # ownership masks, not from the eroded alphas
    a, b = disc(20, 100), disc(10, 100)
    b = np.roll(b, 35, axis=1)

    hole = backdrop_hole([a, b], grow=4)

    assert hole.dtype == np.uint8
    assert hole[(a | b) == 1].min() == 1
    d_out = cv2.distanceTransform((1 - (a | b)).astype(np.uint8), cv2.DIST_L2, 3)
    assert hole[(d_out > 0) & (d_out <= 3)].min() == 1  # grown past the edge
    assert hole[d_out > 8].max() == 0  # but not indefinitely


def test_decontaminate_paints_the_halo_band_with_the_nearest_interior_colour():
    # a grey figure on a red ground: the red pixels just outside the support
    # are what texture filtering drags into the feathered edge
    m = disc(20, 80)
    grey, red = np.array([120, 120, 120], np.uint8), np.array([200, 30, 30], np.uint8)
    img = np.where(m[..., None] == 1, grey, red).astype(np.uint8)

    out = decontaminate(img, m, px=4)

    d_out = cv2.distanceTransform((1 - m).astype(np.uint8), cv2.DIST_L2, 3)
    band = (d_out > 0) & (d_out <= 3.5)
    assert out.shape == img.shape and out.dtype == np.uint8
    np.testing.assert_array_equal(out[band], np.broadcast_to(grey, (int(band.sum()), 3)))
    np.testing.assert_array_equal(out[m == 1], img[m == 1])  # the interior is untouched
    np.testing.assert_array_equal(out[d_out > 6], img[d_out > 6])  # so is the far ground


def test_decontaminate_pulls_each_pixel_from_its_own_nearest_interior_pixel():
    # a two-tone figure: the band outside the left half must stay the left
    # half's colour, not average across the figure
    m = np.zeros((40, 80), np.uint8)
    m[10:30, 10:70] = 1
    img = np.zeros((40, 80, 3), np.uint8)
    img[:, :40] = (50, 50, 50)
    img[:, 40:] = (220, 220, 220)
    img[m == 0] = (0, 0, 255)

    out = decontaminate(img, m, px=3)

    np.testing.assert_array_equal(out[8, 20], (50, 50, 50))
    np.testing.assert_array_equal(out[31, 60], (220, 220, 220))
    np.testing.assert_array_equal(out[20, 8], (50, 50, 50))
    np.testing.assert_array_equal(out[20, 71], (220, 220, 220))
    np.testing.assert_array_equal(out[2, 20], (0, 0, 255))  # beyond px: untouched
