# Transfer measurement (Wire 1/8, #95)

`pnpm transfer` measures what the built site sends over the wire, per tier:
every response's encoded bytes by category, added up to the moment the intro
gate can open and to network idle, on a cold load and a warm second load. It
is the wire companion to the shot gate: what crosses the CDN, not what
renders.

## Baseline

`wire-baseline.json` is the run on main at `40d83b9` (2026-09-01), before any
Wire slice landed. Every later Wire issue reports its before/after against it.

```
desktop  (kB on the wire)
                gate      idle      warm
      html       1.1       1.1       0.0
        js     251.1     251.1       0.0
       css       9.5       9.5       0.0
      font      51.4      51.4       0.0
   texture    2071.5    2071.5       0.0
     other       0.6       0.6       0.0
     total    2385.3    2385.3       0.0
     files        42        42        41

mobile  (kB on the wire)
                gate      idle      warm
      html       1.1       1.1       0.0
        js     251.1     251.1       0.0
       css       9.5       9.5       0.0
      font      51.4      51.4       0.0
   texture     799.1     799.1       0.0
     other       0.6       0.6       0.0
     total    1112.8    1112.8       0.0
     files        42        42        41
```

The desktop tier (2048) is 36 texture files; mobile (1024) the same 36 at
the smaller width. Two latin faces load on the first screen. The warm
column is a second navigation in the same session: every file comes back
from cache under the deploy headers, so nothing crosses the wire.

## How to re-run

```bash
pnpm build
pnpm transfer                       # prints the table
pnpm transfer --json docs/perf/run.json   # and writes the run with its commit
```

The script (`tools/perf/transfer.mjs`) serves `dist/` itself the way
CloudFront does — brotli on html/js/css/json/svg, the deploy workflow's
cache headers — and loads it in hardware headless Chrome over CDP, once as
the desktop tier (1600×900, DPR 2) and once as mobile (390×844, DPR 1.5).
The intro plays, so each cold load is a first visit.

- **gate**: bytes received by the moment the tier's last texture landed —
  in network terms, when `introGateOpen` can turn true. Everything the
  hero needs is in this column.
- **idle**: bytes once the network has been silent for 1.5 s (`--idle`).
- **warm**: idle bytes of a second navigation in the same session.

Timings in the JSON (`gateAt`, `idleAt`, `introDoneAt`, in ms from the
first request) are loopback numbers and only useful relative to each
other; the bytes are the measurement. `--url https://…/` measures a
deployed site instead of `dist/`; `--tiers desktop` runs one tier.

`--throttle 1600 --timeline` slows the connection (kbps down, 150 ms rtt)
and prints the cold load as a timeline — every response's start and end
next to the page's own marks (`trace`: the splash's G-mark trace began;
`gate`) — which is how the order things arrive in is checked: the engine
chunk (#98) starts downloading before the shell has finished, and the trace
is animating before the engine has landed.

## Static budget (Wire 7/8, #100)

`pnpm budget` is the same table without a browser: it reads Vite's manifest
(`dist/.vite/manifest.json`) for the shell chunk and its css, the engine
chunk, the two latin font files and every texture of each tier's
`src/assets/dore/<width>/`, plus `index.html` and the favicon, and sizes
them the way the CDN sends them — brotli for html/js/css/svg, raw for
webp/woff2 — so its numbers line up with the gate column above. It then
checks each tier's total and every category against the ceilings in
`tools/perf/budget.json` and exits 1 on a breach; CI
(`.github/workflows/ci.yml`) runs it after `pnpm build` on every pull
request and push to main.

```bash
pnpm build
pnpm budget            # the table, and the exit code
pnpm budget --files    # every file per tier with its wire kB
pnpm budget --budget other.json   # check against another budget file
```

To raise a ceiling deliberately, change the number in the same PR as the
change that needs it and say why in the PR. #102 tightens the ceilings once
the Wire batch has landed.
