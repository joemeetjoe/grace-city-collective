"""Tests for the figure contact sheet (contact_sheet.py): the camera maths that
places each figure in a waypoint screenshot, and the tiler.

Usage: .venv-recut/bin/python -m pytest tools/recut/test_contact_sheet.py
"""

import numpy as np

from contact_sheet import COMMUNITY, Frame, project, tile


def test_project_puts_the_waypoint_band_centre_at_the_frame_centre_at_any_aspect():
    # the runtime solves the camera so the waypoint's band fills the frame
    # vertically — that is what makes the community zoom the same on every
    # screen, and what the sheet's crops rely on
    (v0, v1), u = COMMUNITY
    for W, H in ((1600, 900), (2400, 1350), (3700, 1350), (1200, 1200)):
        frame = Frame(W, H)
        x, y = project(0.5, (v0 + v1) / 2, 0.0, frame)
        assert abs(x - W / 2) < 1e-6 and abs(y - H / 2) < 1e-6
        _, top = project(0.5, v0, 0.0, frame)
        _, bottom = project(0.5, v1, 0.0, frame)
        assert abs(top) < 1e-6 and abs(bottom - H) < 1e-6


def test_project_moves_a_nearer_layer_more_than_the_plate():
    # parallax: a layer in front of the rest plane projects further from the
    # frame centre than the same plate point on the plane
    frame = Frame(2400, 1350)
    x_flat, _ = project(0.3, 0.44, 0.0, frame)
    x_near, _ = project(0.3, 0.44, 2.0, frame)
    assert x_near < x_flat < 1200


def test_tile_lays_crops_out_in_a_labelled_grid():
    rng = np.random.default_rng(1)
    crops = [(f"fig{i}", rng.integers(0, 255, (60 + i, 90, 3), np.uint8)) for i in range(7)]

    sheet = tile(crops, cols=3, cell=(100, 80), label_h=20)

    assert sheet.dtype == np.uint8
    assert sheet.shape == (3 * (80 + 20), 3 * 100, 3)  # 7 crops -> 3 rows of 3
    # the last row's empty cells are blank, and each crop sits inside its cell
    assert sheet[200:, 100:].max() == 0
    assert sheet[220:280, :90].std() > 0
