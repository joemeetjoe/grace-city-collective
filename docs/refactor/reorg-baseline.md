# Components reorg — screenshot baseline (#85)

Reference captures for the zero-behavior reorg batch (#85–#93) dissolving
`src/components/` into feature + engine modules. Every issue in the batch
diffs its shots against these.

Captured from merge commit `b3b6920` (current main tip, post app-split).

## Where the pixels live

The PNGs are not committed. They sit at:

```
/private/tmp/claude-501/-Users-josephhanson--herdr-worktrees-grace-city-collective-worktree-brave-field-c190/ec8e17f5-9b40-4e2d-acc1-625742014700/scratchpad/reorg-baseline/{desktop,mobile}
```

Regenerate them from b3b6920 with the commands below if that directory is gone.

## Capture parameters

```
pnpm build && pnpm preview --port 4381 --strictPort
node tools/shots/cdp-shot.mjs --url http://localhost:4381/ --out <OUT>/desktop \
     --port 9241 --size 1600x900 --dpr 2 --ids devotions,beliefs,faq,messages
node tools/shots/cdp-shot.mjs --url http://localhost:4381/ --out <OUT>/mobile \
     --port 9241 --size 390x844 --mobile --dpr 3 --menu --ids devotions,beliefs,faq,messages
```

Ten shots per width (six stops + four long-form sections) plus `menu.png` on
mobile — 21 PNGs total. `--dpr 2` is required on desktop or `tierFor()` picks
the mobile tier.

## How to diff

`node tools/shots/pngdiff.mjs <baseline.png> <candidate.png>` — exits 1 when
the share of pixels with any channel delta over 8 exceeds 0.5%.

Self-diff of this baseline against itself is 0 on all 21 shots. Noise-floor
notes from the app-split baseline still apply: mobile who-we-are /
house-churches can spike past the gate when SharedLife rows are caught
mid-print — eyeball before counting those as failures. Long-form shots are
pixel-exact.
