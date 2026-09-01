# App.tsx split — screenshot baseline (#74)

Reference captures for the zero-behavior split batch (#74–#81), taken from the
pristine `origin/main` build (e40d929) before any extraction. Every issue in
the batch diffs its shots against these.

## Where the pixels live

The PNGs (36 MB) are not committed. They sit at:

```
/private/tmp/claude-501/-Users-josephhanson--herdr-worktrees-grace-city-collective-worktree-rapid-meadow-102e/155457e0-852e-48b0-ab3c-73f329019576/scratchpad/baseline/{desktop,mobile}
```

Regenerate them from e40d929 with the commands below if that directory is gone.

## Capture parameters

```
pnpm build && pnpm preview --port <P> --strictPort
node tools/shots/cdp-shot.mjs --url http://localhost:<P>/ --out <OUT>/desktop \
     --port <CDP> --size 1600x900 --dpr 2 --ids devotions,beliefs,faq,messages
node tools/shots/cdp-shot.mjs --url http://localhost:<P>/ --out <OUT>/mobile \
     --port <CDP> --size 390x844 --mobile --dpr 3 --menu --ids devotions,beliefs,faq,messages
```

Ten shots per width (six stops + four long-form sections) plus `menu.png` on
mobile. `--dpr 2` is required on desktop or `tierFor()` picks the mobile tier.

## Panel rects

`app-split-baseline-rects.json` (committed here) is the copy-panel/figure rects
dump from `tools/shots/cdp-rects.mjs` at 1600×900 `--dpr 2`, taken from a
`VITE_SCENE_DEBUG=1` build of the same commit.

## How to diff

`node tools/shots/pngdiff.mjs <baseline.png> <candidate.png>` — pure-node PNG
compare; prints the share of pixels with any channel delta over 8, exits 1
above 0.5%.

Measured same-build noise floor (dust motes, in-turn ornament timing):
desktop ≤ 0.27%; mobile who-we-are / house-churches ≤ ~0.55% and occasionally
~1.2% on who-we-are when the SharedLife rows are caught mid-print — a diff over
the gate on those two stops needs an eyeball before it counts as a failure.
Long-form shots are pixel-exact (max delta ≤ 3).
