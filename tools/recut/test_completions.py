"""Tests for the completion geometry (issue #20)."""

import numpy as np

from completions import (Body, Torso, completed_z, crop_rect, extrude_down, hole_region,
                         keep_region, occluders, reach_region, torso)


def head() -> np.ndarray:
    m = np.zeros((300, 300), np.uint8)
    m[40:80, 130:170] = 1  # a 40x40 head, chin at row 79
    return m


def test_extrude_down_fills_each_column_from_its_lowest_pixel_to_the_floor():
    m = np.zeros((100, 50), np.uint8)
    m[10:30, 10:20] = 1
    m[10:60, 20:30] = 1  # this column block already reaches lower

    out = extrude_down(m, bottom=80)

    assert out[30:81, 10:20].all() and not out[:30, 10:20].any()
    assert out[60:81, 20:30].all() and not out[:60, 20:30].any()
    assert not out[81:, :].any()  # nothing below the floor
    assert not out[:, 30:].any()  # columns without mask stay empty


def test_torso_hangs_from_the_chin_and_excludes_the_head():
    h = head()

    out = torso(h, half_w=60, bottom=250)

    assert not (out & h).any()
    assert out[200, 150] == 1  # column under the head
    assert out[120, 100] == 1  # shoulders reach sideways past the head
    assert out[200, 60] == 0  # but not this far
    assert out[260, 150] == 0  # nothing below the floor row


def test_body_reach_is_a_margin_plus_the_extrusion_without_the_visible_pixels():
    vis = np.zeros((300, 300), np.uint8)
    vis[100:200, 100:160] = 1

    reach = reach_region(Body(reach=20, hole_reach=40), vis, bottom=280)

    assert not (reach & vis).any()
    assert reach[150, 170] == 1 and reach[150, 190] == 0  # margin 20 past x=159, not 31
    assert reach[270, 130] == 1  # extruded down to the floor


def test_body_hole_reaches_further_but_only_toward_the_occluders():
    vis = np.zeros((300, 300), np.uint8)
    vis[100:200, 100:160] = 1
    occluded = np.zeros_like(vis)
    occluded[100:200, 170:300] = 1  # an occluder to the right only

    hole = hole_region(Body(reach=20, hole_reach=40), vis, bottom=280, occluded=occluded)

    assert not (hole & vis).any()
    assert hole[150, 190] == 1  # toward the occluder: the full 40px
    assert hole[150, 80] == 0  # away from it (over wall): nothing
    assert hole[270, 130] == 1  # the extrusion is always part of the hole
    reach = reach_region(Body(reach=20, hole_reach=40), vis, bottom=280)
    assert ((reach & occluded) & hole).sum() == (reach & occluded).sum()  # adopted ⊆ hole


def test_torso_hole_and_reach_are_the_same_compact_shape():
    h = head()
    assert (reach_region(Torso(60), h, 250) == hole_region(Torso(60), h, 250, np.ones_like(h))).all()


def test_occluders_are_nearer_figures_overlapping_the_extension():
    ext = np.zeros((200, 200), np.uint8)
    ext[100:200, 50:150] = 1
    masks = {
        1: np.zeros_like(ext), 2: np.zeros_like(ext), 3: np.zeros_like(ext), 4: np.zeros_like(ext),
    }
    masks[1][100:180, 60:140] = 1  # nearer, 6400px overlap
    masks[2][100:180, 60:140] = 1  # same overlap but further back
    masks[3][0:50, 0:50] = 1  # nearer, no overlap
    masks[4][100:110, 50:60] = 1  # nearer, overlap below the threshold
    z = {0: 1.0, 1: 2.0, 2: 0.5, 3: 2.0, 4: 2.0}

    assert occluders(0, ext, masks, z) == [1]


def test_keep_region_is_the_reach_under_the_occluders_only():
    reach = np.ones((50, 50), np.uint8)
    masks = {1: np.zeros_like(reach), 2: np.zeros_like(reach)}
    masks[1][:, :20] = 1
    masks[2][:, 40:] = 1

    keep = keep_region(reach, [1], masks)

    assert keep[:, :20].all() and not keep[:, 20:].any()


def test_completed_z_steps_behind_the_nearest_occluder_and_chains():
    z = {1: 2.6, 2: 2.0, 3: 1.0, 4: 0.5}
    occl = {2: [1], 3: [2], 4: [2, 3]}

    out = completed_z(z, occl, step=0.3)

    assert out[1] == 2.6  # nothing in front: untouched
    assert out[2] == 2.3
    assert out[3] == 2.0  # behind 2's NEW depth, not its old one
    assert out[4] == 1.7  # nearest of its occluders is 3 at 2.0


def test_completed_z_never_goes_below_the_floor():
    out = completed_z({1: 0.0, 2: 0.0}, {2: [1]}, step=0.3, floor=-0.1)
    assert out[2] == -0.1


def test_crop_rect_pads_and_clips_to_the_image():
    m = np.zeros((100, 100), np.uint8)
    m[5:20, 90:100] = 1

    assert crop_rect(m, pad=10) == (80, 0, 20, 30)
