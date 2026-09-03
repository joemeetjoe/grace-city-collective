# Vitals batch (#103–#115): beyond bytes

Thirteen slices, 2026-09-01/02, on top of the Wire batch
([wire-batch.md](wire-batch.md)). Measured with `pnpm lighthouse` (Lighthouse
12.6.1 via @lhci/cli, three runs per profile, the median run) and
`pnpm transfer`. Baseline is the first gated run (#112, on top of the Wire
batch); final is the batch tip `87498a7` with every slice merged. The two
median reports sit beside this file as `vitals-final-{mobile,desktop}.json`
(baseline: `lighthouse-baseline-*.json`), the transfer as `vitals-final.json`.

## Lighthouse, baseline → final

| profile | perf | a11y | BP | SEO | FCP | LCP | TBT | Speed Index | TTI | CLS |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: |
| mobile, baseline | 80 | 96 | 100 | 90 | 2105 | 4163 | 172 | 3715 | 4213 | 0.000 |
| mobile, final | **93** | 96 | 100 | **100** | **755** | **2855** | **53** | 4510 | 5244 | 0.000 |
| desktop, baseline | 99 | 100 | 100 | 90 | 404 | 626 | 0 | 1372 | 628 | 0.003 |
| desktop, final | 97 | 100 | 100 | **100** | 450 | 908 | 0 | 1547 | 914 | **0.000** |

Times in ms. Mobile is Lighthouse's default (150 ms RTT, 1.6 Mbps, 4× CPU,
360×640 at DPR 2.625); desktop is the `desktop` preset.

What moved, and what did not:

- **FCP mobile 2105 → 755 ms, LCP 4163 → 2855 ms.** The splash headline
  (#107) is the first and largest paint; the stylesheet no longer blocks
  (#105) and the faces are preloaded with matched fallbacks (#106).
  Observed in the browser, LCP lands *with* FCP (one LCP entry, the splash
  h1); Lighthouse's simulated LCP still trails its FCP because Lantern folds
  every response finished by the observed LCP into the estimate. The
  `largest-contentful-paint-element` audit reads not applicable: the node
  is adopted into the live splash and removed at the handoff.
- **TBT mobile 172 → 53 ms.** Texture uploads are spread across frames
  behind the splash (#104); the remaining long tasks are drafted as slices
  in [main-thread-slices.md](main-thread-slices.md) (#114).
- **SEO 90 → 100 on both** (#108). **CLS 0 on both** (#106).
- **Speed Index mobile 3715 → 4510 ms, TTI 4213 → 5244 ms; desktop LCP
  626 → 908 ms.** These are worse, and they are one cause: the head script
  now preloads every texture of the tier (#113), and on the HTTP/1.1 static
  server Lighthouse and the transfer harness use, 54 texture requests share
  the six connections with the shell chunk, so the shell lands later on a
  throttled link (desktop at 1.6 Mbps: 1761 → 5024 ms in the transfer
  timeline), the intro trace starts later, and the hero — the frame Speed
  Index and TTI settle on — arrives later. Unthrottled, the same change
  opened the gate at 59 ms instead of 412 ms on mobile. CloudFront serves
  HTTP/2 with its own prioritisation, so the deployed site decides this:
  measure it with `pnpm transfer --url https://…/` after the first deploy.
  The lever, if the shell must win, is already in place: the head script's
  `fetchpriority` split (hero set high, the rest low) can be narrowed to
  preload the hero set only and leave the rest to the bundle's injector.
  Recorded here rather than reverted: the ceilings below hold the measured
  values, so the deploy measurement can lower them deliberately.
- **Accessibility mobile 96**: the one red error assertion, the kicker
  labels' colour contrast (seal on ink, 2.42:1 at 11 px; see
  [lighthouse-baseline.md](lighthouse-baseline.md)). A brand-colour
  decision, left open; the gate stays at 100 so the decision is forced.

## Transfer, final (`pnpm transfer`, AVIF path, cold to gate / warm)

```
desktop  (kB on the wire)
                gate      idle      warm
      html       8.7       8.7       0.0
        js     249.8     249.8       0.0
       css       8.8       8.8       0.0
      font      51.4      51.4       0.0
   texture    1557.9    1557.9       0.0
     other       0.6       0.6       0.0
     total    1877.2    1877.2       0.0
     files        61        61        60

mobile  (kB on the wire)
                gate      idle      warm
      html       8.7       8.7       0.0
        js     249.8     249.8       0.0
       css       8.8       8.8       0.0
      font      51.4      51.4       0.0
   texture     614.6     614.6       0.0
     other       0.0       0.6       0.0
     total     933.3     933.9       0.0
     files        60        61        60
```

Against the Wire batch's final (desktop 1869.3 kB, mobile 926.0 kB): html
1.2 → 8.7 kB (the noscript content, JSON-LD and the head script's two tier
lists), css 9.5 → 8.8 kB, js 248.7 → 249.8 kB (zustand-free; the long-form
chunk is out of the first load and arrives on scroll, 1.8 kB), textures and
fonts unchanged. Warm loads are fully cached. The poster path is measured in
`pnpm transfer --reduced-motion`: one image per tier, no texture, no
engine chunk (desktop 486 kB, mobile 77 kB).

## What each slice moved

| slice | what | moved |
| --- | --- | --- |
| #103 | build-output vitest project, `pnpm test:build` | — (the place every later check lives) |
| #104 | textures warmed behind the splash | longest mobile task 189 → 104 ms; TBT 172 → ~60 ms |
| #105 | stylesheet trimmed, loaded non-blocking | css 9.5 → 8.7 kB brotli; nothing render-blocking in head |
| #106 | latin faces preloaded, metric-matched fallbacks | CLS desktop 0.003 → 0.000; fonts-blocked line boxes 0 px off |
| #107 | the headline on the splash (recto composition, pending sign-off) | mobile LCP 4165 → ~3000 ms; LCP = FCP observed |
| #108 | SEO and AI surfaces from site.ts | SEO 90 → 100; robots, sitemap, JSON-LD, llms.txt, noscript |
| #109 | poster width ladder, AVIF + WebP | fallback path desktop 824 → 486 kB, mobile 445 → 77 kB |
| #110 | dead deps gone, knip in CI | — (shell byte-identical) |
| #111 | long-form lazy chunk behind in-view | 1.8 kB out of the first load; a nav jump loads then lands |
| #112 | Lighthouse CI gate + axe | the gate itself; `main` landmark added |
| #113 | whole-tier preload from the head script | mobile gate-open 412 → 59 ms unthrottled; SI/TTI regression on HTTP/1.1 (above) |
| #114 | main-thread slices drafted from the trace | four fileable drafts with measured costs |
| #115 | ceilings to errors, this document | — |

## The simulated paint is bimodal; the gate reads the browser

Measured while integrating the Shape batch, and worth knowing before anyone
reads a red mobile LCP as a regression.

Lighthouse's mobile LCP here is Lantern's estimate, not a measurement. The
page's first paint is the splash headline, inline in the HTML with nothing
render-blocking ahead of it, and Lantern prices that two different ways from
run to run:

| branch | run 1 | run 2 | run 3 |
| --- | --: | --: | --: |
| Vitals tip, simulated FCP / LCP | 2107 / 6175 | 755 / 2855 | 757 / 2857 |
| Shape tip, simulated FCP / LCP | 2183 / 4733 | 2179 / 5554 | 2180 / 5555 |

Probing single commits across the Shape batch lands in either mode with no
pattern (#117 low, #116 high, #118 low, #120 high), so the mode is not a
property of the code. The browser's own number, from a PerformanceObserver
on `largest-contentful-paint`, does not move at all:

| profile | observed LCP, every run |
| --- | --: |
| desktop | 27-47 ms |
| mobile | 30-46 ms |

So the mobile LCP assertion is a warning, and `pnpm paint`
(`tools/perf/paint.mjs`) is the gate that holds the promise #107 made: the
largest paint must be the splash headline and must land inside 400 ms, on
both profiles, read from the browser. CI runs it after `pnpm budget`.
Desktop LCP, TBT, Speed Index and CLS stay errors: they are stable.

## Gate ceilings (`tools/perf/lighthouseProfiles.cjs`)

Errors: accessibility, SEO and best practices at 100; CLS ≤ 0.01; TBT and
Speed Index at the final median plus a stated margin; and the observed paint
through `pnpm paint`. Mobile LCP warns only, for the reason above:

| profile | LCP | TBT | Speed Index |
| --- | --: | --: | --: |
| mobile | 3400 ms (2855 + ~20 %) | 150 ms (53; runs spread 50–210) | 5200 ms (4510 + ~15 %) |
| desktop | 1100 ms (908 + ~20 %) | 50 ms (noise floor) | 1850 ms (1547 + ~20 %) |

## Decisions this batch settled

- The headline on the splash is the LCP answer (#107, composition `recto`,
  pending the eye sign-off in docs/design/issue-107). #113 remains the
  fallback answer had #107 closed won't-do; both shipped.
- The preview tier (an LQIP for WebGL) stays behind its rule: gate-open on
  the mobile lab profile is under four seconds (2.9 s to LCP, textures
  preloaded from the HTML), so it gets no batch.
- React and Vite stay; Preact-compat is the one bundle lever worth a spike,
  not taken. Prerendering is deferred; if ever, it is a build script, not a
  framework.
- Every crawler is welcome, AI crawlers included (robots.txt names none).
- No field reporting; CloudFront reports are the visit count. An anonymous
  vitals beacon is the next step only if the tier decision ever needs field
  evidence.
- The fonts line in Wire 8/8 is revised: the latin faces are preloaded with
  metric-matched fallbacks (#106).
- Head-script texture preload vs. shell priority is decided by the deployed
  HTTP/2 measurement, not the local harness (above).
- Open: the kicker contrast (brand colour), the #107 composition sign-off,
  and the four #114 drafts to file.
