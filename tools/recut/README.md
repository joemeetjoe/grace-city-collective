# recut

The parallax cut set — masks, colour maps, the inpainted backdrop and
`cuts.json` — built from SAM masks by `build_cuts.py`. Outputs land in
`dist/`; `pack_textures.py` then encodes them into the two tiers the site
ships, `public/dore/2048/` and `public/dore/1024/` (WebP, masks packed four
to a texture — see `docs/design/issue-26/`).

```
.venv-recut/bin/python tools/recut/build_cuts.py            # full build, ~3 min (LaMa)
.venv-recut/bin/python tools/recut/build_cuts.py --fill tile  # instant; masks and maps only
.venv-recut/bin/python tools/recut/pack_textures.py         # dist/ -> public/dore/{2048,1024}, ~2 min
.venv-recut/bin/python tools/recut/pack_textures.py --compare  # codec crops -> docs/design/issue-26/
.venv-recut/bin/python -m pytest tools/recut/test_*.py
```

## Figure contact sheet

Every figure at the community dolly, one 1:1 crop each, so an edge artifact
(issue #28) is found by looking at all of them. Rerun after any recut and
compare with `docs/design/issue-28/{before,after}.jpg`.

```
pnpm build && pnpm preview --port 4228 &
node tools/shots/cdp-shot.mjs --url http://localhost:4228/ --out /tmp/sheet \
     --port 9328 --labels Community --size 3700x1350 \
     --css "[data-parallax]>div[aria-hidden],[data-parallax]+div,section[data-screen-label]{visibility:hidden}"
.venv-recut/bin/python tools/recut/contact_sheet.py /tmp/sheet/03-community.png --out /tmp/sheet.jpg
```

3700x1350 shows the whole ring at the community zoom (the camera distance is
solved from the band's height, so a wide frame only adds width); the `--css`
hides the copy and vignette that sit over the scene.
