"""Tests for the synthesized wall behind the apostles (ray_wall.py): the
pure geometry and normalisation. The full fill is judged by eye from
dist/qc-raywall.jpg.

Usage: .venv-recut/bin/python -m pytest tools/recut/test_ray_wall.py
"""

import numpy as np

from ray_wall import (block_carrier, block_rows, mirror_left, radial_map, ray_modulation, ray_wall, seam_correction,
                      seam_offset, tile_x, unit_carrier)


def test_radial_map_seam_samples_the_source_bottom_and_keeps_the_ray_angle():
    H, W = 1000, 800
    origin = (0.5, 0.05)
    band, src = (400, 800), (100, 300)

    map_x, map_y = radial_map((H, W), band, src, origin)

    assert map_x.shape == map_y.shape == (400, W)
    # the top band row samples the source's bottom row, the last its top
    assert map_y[0, 0] == src[1]
    assert map_y[-1, 0] == src[0]
    # the column through the apex stays put
    ox, oy = origin[0] * W, origin[1] * H
    np.testing.assert_allclose(map_x[:, int(ox)], ox, atol=1e-3)
    # every other pixel samples along its own ray: same angle from the apex
    for row, col in ((0, 0), (200, 100), (399, W - 1)):
        y = band[0] + row
        want = (col - ox) / (y - oy)
        have = (map_x[row, col] - ox) / (map_y[row, col] - oy)
        assert have == pytest_approx(want)


def pytest_approx(v, rel=1e-4):
    import pytest
    return pytest.approx(v, rel=rel, abs=1e-4)


def test_ray_modulation_rows_have_unit_mean_within_the_clamp():
    rng = np.random.default_rng(3)
    strip = 60 + 30 * np.sin(np.arange(400) * 0.2)[None, :] + rng.normal(0, 5, (120, 400))
    strip = strip.clip(1, 255).astype(np.float32)

    mod = ray_modulation(strip, sigma=(2.0, 20.0), lo_hi=(0.6, 1.6))

    assert mod.shape == strip.shape
    assert mod.min() >= 0.6 and mod.max() <= 1.6
    np.testing.assert_allclose(mod.mean(axis=1), 1.0, atol=0.05)


def test_mirror_left_replaces_the_left_with_the_mirrored_right():
    strip = np.tile(np.arange(100, dtype=np.float32), (4, 1))

    out = mirror_left(strip, mirror_x=0.3, blend_px=4)

    np.testing.assert_allclose(out[:, :26], strip[:, ::-1][:, :26])
    np.testing.assert_allclose(out[:, 34:], strip[:, 34:])


def test_block_rows_is_a_whole_number_of_pitches():
    n = block_rows(6.487, pitches=(4, 16))

    m = n / 6.487
    assert abs(m - round(m)) < 0.1
    assert 4 * 6.487 - 1 <= n <= 16 * 6.487 + 1


def test_block_carrier_stacks_whole_blocks_from_the_offset():
    rows = np.arange(50, dtype=np.float32)[:, None] * np.ones((1, 3), np.float32)

    out = block_carrier(rows, n=10, height=45, offset=3, seed=1)

    assert out.shape == (45, 3)
    # every block starts on the offset's phase: its first row is offset + 10k
    assert all((out[i, 0] - 3) % 10 == 0 for i in range(0, 45, 10))
    # and runs 10 consecutive source rows
    for i in range(0, 40, 10):
        np.testing.assert_allclose(out[i:i + 10, 0], out[i, 0] + np.arange(10))


def test_seam_offset_picks_the_offset_that_continues_the_phase():
    pitch = 8
    y = np.arange(200)
    carrier = (1 + 0.5 * np.sin(2 * np.pi * y / pitch))[:, None] * np.ones((1, 5), np.float32)
    # rows above the seam whose phase continues from an offset of 5
    above = carrier[5:5 + 24]

    # any offset a whole number of pitches from 5 continues the phase equally
    assert (seam_offset(carrier, n=pitch * 3, above=above) - 5) % pitch == 0


def test_unit_carrier_has_unit_local_mean():
    rng = np.random.default_rng(0)
    tile = (80 + 40 * np.sign(np.sin(np.arange(300) * 1.0))[:, None] + rng.normal(0, 3, (300, 200))).astype(np.float32)

    out = unit_carrier(tile, sigma=8.0)

    assert abs(out[20:-20].mean() - 1.0) < 0.02


def test_tile_x_keeps_each_row_and_reaches_the_width():
    patch = np.arange(6, dtype=np.float32)[:, None] * np.ones((1, 40), np.float32)

    out = tile_x(patch, 130)

    assert out.shape == (6, 130)
    np.testing.assert_allclose(out, np.arange(6, dtype=np.float32)[:, None] * np.ones((1, 130)), atol=1e-3)


def test_seam_correction_matches_the_seam_and_decays_to_one():
    above = np.full((10, 300), 40.0, np.float32)
    first = np.full(300, 80.0, np.float32)

    gain = seam_correction(above, first, depth=800, sigma=10.0, fall=100.0)

    assert gain.shape == (800, 300)
    np.testing.assert_allclose(gain[0], 0.5, atol=1e-3)
    assert gain[-1].max() < 1.001 and gain[-1].min() > 0.999


def test_ray_wall_leaves_everything_outside_the_band_untouched():
    rng = np.random.default_rng(5)
    H, W = 2000, 400
    lines = (70 + 35 * np.sign(np.sin(np.arange(H) * 1.0)))[:, None, None]
    plate = (lines + rng.normal(0, 4, (H, W, 3))).clip(0, 255).astype(np.uint8)
    backdrop = plate.copy()

    out = ray_wall(plate, backdrop, band_rows=(0.4, 0.8))

    y0, y1 = int(H * 0.4), int(H * 0.8)
    np.testing.assert_array_equal(out[:y0], backdrop[:y0])
    np.testing.assert_array_equal(out[y1:], backdrop[y1:])
    assert out.shape == plate.shape and out.dtype == np.uint8
    # the band is wall, not black: its tone tracks the surround
    assert abs(float(out[y0 + 40:y1 - 40].mean()) - float(plate.mean())) < 25
