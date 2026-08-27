# Issue #20 — AI completion of figures hidden behind other figures

Trial of SDXL-inpainting (`diffusers/stable-diffusion-xl-1.0-inpainting-0.1`, fp16 on
Apple MPS) inventing the hidden torso of two figures whose heads SAM cut apart from
the bodies occluding them. Script: `tools/recut/exp_figure_completion.py`.

| case | who | hole | time / image |
|---|---|---|---|
| A | bearded head between Mary's veil and the praying man | 175 k px behind Mary + the praying man's arm | 4.8–6.3 min |
| D | small head above the bowing man's back | 67 k px behind the bowing man's back | 6.4–6.7 min |

`*-overview.jpg`: plate crop · hole (red) · seed 0 · seed 1.
`*-detail.jpg`: the hole region at 1:1 — plate · seed 0 · seed 1.

## Verdict: rejected, keep `FIG_MERGE`

At thumbnail both cases read as "a robe". At 1:1 — which is where the dolly puts the
viewer in sections 3–4 — neither seed holds Doré's line: seed 0 produces scribbled
cross-hatch / pebbled rope texture, seed 1 a soft grey wash with faint lines. The
invented region is also 10–15 % brighter than the surrounding plate on every run.
A merged head that never separates from its body is the better artefact.

Not tried (would need a GPU this machine doesn't have): FLUX.1-Fill, a LoRA trained on
the plate. If either is revisited, the depth note on #20 still applies — completed
pixels need their own depth for the relief shader.

## Update: shipped after all

The verdict above judged the whole invented torso at 1:1. In the scene the torso
sits **under** the front figure at rest; parallax only ever reveals a strip along the
occluder's edge, so the bar is "continue tone and line at that edge", not "paint a
Doré torso". With that framing — plus tone-matching the generated pixels to the
plate's brightness guide, adopting only the pixels the occluders own (so the scene at
rest still equals the plate), and placing each figure a step behind its nearest
occluder (so the revealed strip stays narrow) — SDXL-inpainting was good enough for
all 11 hidden figures, and every figure now rides its own depth plane.

Pipeline: `tools/recut/completions.py` (geometry) → `build_cuts.py` (holes, adopted
regions, per-figure cropped `map-figN.jpg` / `depth-figN.png`, `mapRect` in
`cuts.json`) → `complete_figures.py --generate` (candidates + contact sheets) →
`completion_picks.json` → `complete_figures.py --pick` (tone match + per-figure depth)
→ `build_cuts.py` again. Picks were scored on tone, hatch contrast and line
orientation in the revealable band.
