"""Tests for the runtime texture tiers (pack_textures.py): channel packing,
the manifest's mask references, and the tier resizer.

Usage: .venv-recut/bin/python -m pytest tools/recut/test_pack_textures.py
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image

import pytest

from pack_textures import (build_manifest, crowd_rect, hollow, pack_channels, plan_packs, resolve_masks,
                           unpack_channels, write_tier)


def masks(n: int, shape=(6, 5)) -> list[np.ndarray]:
    rng = np.random.default_rng(n)
    return [rng.integers(0, 256, shape, np.uint8) for _ in range(n)]


def test_pack_channels_round_trips_four_masks_exactly():
    ms = masks(4)
    packed = pack_channels(ms)

    assert packed.shape == (6, 5, 4)
    assert packed.dtype == np.uint8
    for got, want in zip(unpack_channels(packed, 4), ms):
        np.testing.assert_array_equal(got, want)


def test_pack_channels_pads_a_short_group_with_empty_channels():
    ms = masks(3)
    packed = pack_channels(ms)

    assert packed.shape == (6, 5, 4)
    assert packed[..., 3].max() == 0
    for got, want in zip(unpack_channels(packed, 3), ms):
        np.testing.assert_array_equal(got, want)


def test_pack_channels_refuses_more_than_four_or_mismatched_shapes():
    with pytest.raises(ValueError):
        pack_channels(masks(5))
    with pytest.raises(ValueError):
        pack_channels([np.zeros((4, 4), np.uint8), np.zeros((4, 5), np.uint8)])


def test_hollow_keeps_the_masked_pixels_and_a_margin_and_smooths_the_rest():
    rng = np.random.default_rng(3)
    image = rng.integers(0, 256, (64, 64, 3), np.uint8)
    keep = np.zeros((32, 32), np.uint8)  # half the image's resolution, like the masks
    keep[8:16, 8:16] = 255  # -> image rows/cols 16..32

    out = hollow(image, keep, margin=4, sigma=3)

    np.testing.assert_array_equal(out[16:32, 16:32], image[16:32, 16:32])
    np.testing.assert_array_equal(out[12:36, 12:36], image[12:36, 12:36])  # the margin
    far = out[48:, 48:].astype(int)
    assert np.abs(np.diff(far, axis=0)).mean() < np.abs(np.diff(image[48:, 48:].astype(int), axis=0)).mean() / 4
    assert far.std() < image[48:, 48:].std() / 2


# ----------------------------------------------------------------------------
# manifest and tiers, on a toy dist/

def toy_dist(tmp_path) -> tuple[Path, list[dict]]:
    """A 64x80 plate with two figures, one of them completed (own map, depth),
    five flames, and the crowd/dove/arch/floor cuts, masks at half size."""
    dist = tmp_path / "dist"
    dist.mkdir()
    rng = np.random.default_rng(0)
    W, H = 64, 80
    Image.fromarray(rng.integers(0, 256, (H, W), np.uint8), "L").save(dist / "plate.jpg", quality=90)
    Image.fromarray(rng.integers(0, 256, (H, W, 3), np.uint8)).save(dist / "plate-backdrop.png")
    Image.fromarray(rng.integers(0, 256, (H // 2, W // 2), np.uint8), "L").save(dist / "depth.png")
    cuts = [
        {"name": "fig0", "z": 1.7, "isFlame": 0, "relief": 1, "map": "map-fig0.jpg",
         "mapRect": [0.25, 0.25, 0.5, 0.5], "depthMap": "depth-fig0.png"},
        {"name": "fig1", "z": 2.1, "isFlame": 0, "relief": 1},
        *({"name": f"flame{i}", "z": -1.7, "isFlame": 1, "parent": "fig1"} for i in range(5)),
        {"name": "crowd", "z": -5.6, "isFlame": 0, "map": "map-crowd.jpg"},
        {"name": "dove", "z": -3.0, "isFlame": 0},
        {"name": "arch", "z": -2.8, "isFlame": 0},
        {"name": "floor", "z": 3.6, "isFlame": 0},
    ]
    for c in cuts:
        m = np.zeros((H // 2, W // 2), np.uint8)
        if c["name"] == "crowd":
            m[16:28] = 255
        else:
            m[rng.integers(0, 30):][:8, rng.integers(0, 20):][:, :8] = 255
        Image.fromarray(m, "L").save(dist / f"cut-{c['name']}.png")
    Image.fromarray(rng.integers(0, 256, (H, W, 3), np.uint8)).save(dist / "map-crowd.jpg", quality=90)
    Image.fromarray(rng.integers(0, 256, (40, 32, 3), np.uint8)).save(dist / "map-fig0.jpg", quality=90)
    Image.fromarray(rng.integers(0, 256, (20, 16), np.uint8), "L").save(dist / "depth-fig0.png")
    (dist / "cuts.json").write_text(json.dumps(cuts))
    return dist, cuts


def test_plan_packs_puts_flames_and_cuts_in_separate_groups_of_four_nearest_first(tmp_path):
    _, cuts = toy_dist(tmp_path)

    packs = plan_packs(cuts)

    assert [f for f, _ in packs] == ["masks-flame-0.webp", "masks-flame-1.webp",
                                     "masks-cut-0.webp", "masks-cut-1.webp"]
    assert packs[0][1] == ["flame0", "flame1", "flame2", "flame3"]
    assert packs[1][1] == ["flame4"]
    assert packs[2][1] == ["floor", "fig1", "fig0", "arch"]  # by z, nearest first
    assert packs[3][1] == ["dove", "crowd"]


def test_build_manifest_references_every_mask_by_file_and_channel_and_keeps_the_rest():
    cuts = [{"name": "fig0", "z": 1.7, "isFlame": 0, "relief": 1, "map": "map-fig0.jpg",
             "mapRect": [0.25, 0.25, 0.5, 0.5], "depthMap": "depth-fig0.png"},
            {"name": "flame0", "z": -1.7, "isFlame": 1, "parent": "fig0"},
            {"name": "crowd", "z": -5.6, "isFlame": 0, "map": "map-crowd.jpg"}]
    packs = [("masks-flame-0.webp", ["flame0"]), ("masks-cut-0.webp", ["fig0", "crowd"])]

    manifest = build_manifest(cuts, packs, {"crowd": [0.0, 0.4, 1.0, 0.4]})

    assert manifest[0] == {"name": "fig0", "z": 1.7, "isFlame": 0, "relief": 1, "map": "map-fig0.webp",
                           "mapRect": [0.25, 0.25, 0.5, 0.5], "depthMap": "depth-fig0.webp",
                           "mask": {"file": "masks-cut-0.webp", "channel": 0}}
    assert manifest[1] == {"name": "flame0", "z": -1.7, "isFlame": 1, "parent": "fig0",
                           "mask": {"file": "masks-flame-0.webp", "channel": 0}}
    assert manifest[2] == {"name": "crowd", "z": -5.6, "isFlame": 0, "map": "map-crowd.webp",
                           "mapRect": [0.0, 0.4, 1.0, 0.4], "mask": {"file": "masks-cut-0.webp", "channel": 1}}
    assert "mapRect" not in cuts[2]  # input untouched


def test_crowd_rect_spans_the_rows_the_mask_touches_plus_a_margin():
    m = np.zeros((100, 40), np.uint8)
    m[30:50] = 255

    assert crowd_rect(m) == [0.0, 0.26, 1.0, 0.28]
    assert crowd_rect(np.zeros((100, 40), np.uint8)) == [0.0, 0.0, 1.0, 1.0]


def test_write_tier_resolves_every_mask_and_round_trips_them_exactly(tmp_path):
    dist, cuts = toy_dist(tmp_path)

    out = write_tier(cuts, 2048, dist, tmp_path / "dore")
    manifest = json.loads((out / "cuts.json").read_text())

    refs = resolve_masks(manifest, out)
    assert set(refs) == {c["name"] for c in cuts}
    for c in cuts:
        path, channel = refs[c["name"]]
        got = np.asarray(Image.open(path))[..., channel]
        np.testing.assert_array_equal(got, np.asarray(Image.open(dist / f"cut-{c['name']}.png")))
    for c in manifest:
        for key in ("map", "depthMap"):
            if key in c:
                assert (out / c[key]).exists(), c[key]
    for name in ("plate.webp", "plate-backdrop.webp", "depth.webp"):
        assert (out / name).exists()


def test_write_tier_1024_is_the_2048_tier_at_half_size_with_the_same_manifest(tmp_path):
    dist, cuts = toy_dist(tmp_path)

    big = write_tier(cuts, 2048, dist, tmp_path / "dore")
    small = write_tier(cuts, 1024, dist, tmp_path / "dore")

    assert sorted(p.name for p in big.iterdir()) == sorted(p.name for p in small.iterdir())
    for p in big.iterdir():
        if p.suffix == ".webp":
            w, h = Image.open(p).size
            assert Image.open(small / p.name).size == (max(1, round(w / 2)), max(1, round(h / 2))), p.name
    m_big = json.loads((big / "cuts.json").read_text())
    m_small = json.loads((small / "cuts.json").read_text())
    assert m_big == m_small
    rects = {c["name"]: c["mapRect"] for c in m_big if "mapRect" in c}
    assert rects["fig0"] == [0.25, 0.25, 0.5, 0.5]  # as authored
    assert rects["crowd"] == crowd_rect(np.asarray(Image.open(dist / "cut-crowd.png")))
    assert all(0 <= v <= 1 for r in rects.values() for v in r)


def test_write_tier_is_idempotent_and_clears_stale_files(tmp_path):
    dist, cuts = toy_dist(tmp_path)
    out = write_tier(cuts, 1024, dist, tmp_path / "dore")
    (out / "cut-old.png").write_bytes(b"stale")
    first = {p.name: p.read_bytes() for p in out.iterdir() if p.name != "cut-old.png"}

    again = write_tier(cuts, 1024, dist, tmp_path / "dore")

    assert not (again / "cut-old.png").exists()
    assert {p.name: p.read_bytes() for p in again.iterdir()} == first
