"""Tests for the dolly geometry (dolly.py): how far two cut planes slide
against each other on screen, in plate pixels, as the camera visits the
waypoints PentecostParallax.tsx drives it through.

Usage: .venv-recut/bin/python -m pytest tools/recut/test_dolly.py
"""

import pytest

from dolly import (BACKDROP_Z, ASPECTS, POINTER_EXTREMES, WAYPOINTS, Camera, base_z, camera, row_seen,
                   screen_y, shear_px, worst_shear)


def every_camera():
    for wp in range(len(WAYPOINTS)):
        for aspect in ASPECTS:
            for pointer in POINTER_EXTREMES:
                yield camera(wp, aspect, pointer)


def test_registration_camera_shows_every_layer_where_the_plate_is():
    # the whole cut set registers from (0, 0, baseZ): from there a row of any
    # layer lands exactly where the same row of the flat plate would
    bz = base_z(16 / 9)
    cam = Camera(x=0.0, y=0.0, z=bz, base_z=bz, mult=1.5, aspect=16 / 9)

    for z in (-5.6, -0.9, 2.6):
        for v in (0.05, 0.45, 0.8):
            assert row_seen(z, screen_y(v, 0.0, cam), cam) == pytest.approx(v, abs=1e-9)


def test_layers_at_one_depth_never_shear():
    for cam in every_camera():
        for z in (-5.6, -0.9, 2.6):
            for v in (0.1, 0.45, 0.8):
                assert shear_px(z, z, v, cam) == pytest.approx(0.0, abs=1e-6)


def test_shear_grows_with_the_depth_gap_and_with_the_dolly():
    community = camera(3, 16 / 9)
    hero = camera(0, 16 / 9)
    head = 0.45  # a face row, just under the community aim

    against_wall = shear_px(2.6, BACKDROP_Z, head, community)
    against_crowd = shear_px(2.6, -0.9, head, community)
    assert against_wall > against_crowd > 0
    assert against_wall > shear_px(2.6, BACKDROP_Z, head, hero)


def test_worst_shear_is_the_deepest_dolly_that_still_frames_the_row():
    # the give waypoint dollies deeper still, but aims at the dove; a face row
    # is off-frame there, so it must not count
    px, where = worst_shear(2.6, BACKDROP_Z, 0.45)

    assert where["waypoint"] == 3
    assert px == pytest.approx(shear_px(2.6, BACKDROP_Z, 0.45, camera(3, where["aspect"], where["pointer"])))
    assert 150 < px < 250  # ~200 plate rows revealed above a face at the community dolly
