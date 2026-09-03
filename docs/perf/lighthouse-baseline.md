# Lighthouse baseline (Vitals 10/13, #112)

The first `pnpm lighthouse` run, on branch `wf-112` (the commit that adds
the gate, on top of `185476b`), 2026-09-02, Lighthouse 12.6.1 via
@lhci/cli 0.15.1, hardware headless Chrome on a Mac. Three runs per
profile; the numbers are the median run's, and the two median reports sit
beside this file as `lighthouse-baseline-mobile.json` and
`lighthouse-baseline-desktop.json` (open either in
https://googlechrome.github.io/lighthouse/viewer/). Every later Vitals
slice reports against these.

Both profiles load `dist/index.html` cold, so the intro plays: the splash
is on screen from the first paint and the hero is revealed when it ends.
LCP on mobile is the hero headline behind the splash (`section#hero > h1 >
div.hero-line`, render delay 3.7 s of the 4.2 s); on desktop it is the
wordmark in the chrome lockup (`span.basis-full`) at 0.6 s. #107 (the
splash headline as LCP) and #113 (the fallback) are what move the mobile
number.

## Scores and metrics

| profile | perf | a11y | best practices | SEO | LCP | TBT | Speed Index | CLS |
| ------- | ---: | ---: | -------------: | --: | ------: | -----: | ----------: | ----: |
| mobile  |   80 |   96 |            100 |  90 | 4163 ms | 172 ms |     3715 ms | 0.000 |
| desktop |   99 |  100 |            100 |  90 |  626 ms |   0 ms |     1372 ms | 0.003 |

The three runs (LCP / TBT / SI, ms): mobile 4166/188/3816,
4159/178/3787, 4163/172/3715 (median run); desktop 626/0/1415,
632/7/1482, 626/0/1372 (median run). FCP moves between 1.65 s and 2.1 s on
mobile between runs; LCP and TTI do not.

Mobile is Lighthouse's default: 150 ms RTT, 1.6 Mbps, 4× CPU slowdown, a
360×640 viewport at DPR 2.625. Desktop is the `desktop` preset: 40 ms
RTT, 10 Mbps, no CPU slowdown, 1350×940.

## Warning ceilings

`tools/perf/lighthouseProfiles.cjs`, the median plus roughly 20 %:

| profile | LCP     | TBT    | Speed Index |
| ------- | ------: | -----: | ----------: |
| mobile  | 5000 ms | 220 ms |     4600 ms |
| desktop |  750 ms |  50 ms |     1700 ms |

Desktop TBT is 0–7 ms across runs, so its ceiling is a noise floor rather
than +20 %. A warning prints in the lhci log and does not fail CI; #115
turns them into errors once the batch has landed.

## Failing audits

Error assertions that are red on this run, each an issue of its own:

- `color-contrast` (accessibility, mobile only, score 0.96) — *Background
  and foreground colors do not have a sufficient contrast ratio.* The
  kicker labels (`kicker` in `src/theme/classes.ts`: 11 px uppercase,
  `text-seal` #9e1f2e on ink #14100e) measure 2.42:1 against the 4.5:1
  WCAG AA needs for text that size. Four nodes: the kickers of the
  house-churches, gatherings, give and visit panels. On desktop the same
  labels pass (the panels sit on a lighter backdrop there).
- `meta-description` (SEO, both profiles, score 0.90) — *Document does
  not have a meta description.* #108 adds it; the category reaches 100
  once that merges. No other SEO audit fails.

Best practices is 100 on both. Its one diagnostic (weight 0) is
`valid-source-maps` — *Missing source maps for large first-party
JavaScript* — informational only.

Both profiles' CLS is under the 0.01 error ceiling; desktop's 0.003 is
one shift on `nav.fixed`.

## Long tasks (mobile)

From `long-tasks` in the mobile median report; all in the shell chunk
(`assets/index-*.js`), all between 3.0 s and 3.6 s into the load — the
window in which the shell mounts and the splash hands off. This is the
list #114 slices — the attribution and the drafts are in
[`main-thread-slices.md`](main-thread-slices.md):

| start   | duration | script          |
| ------: | -------: | --------------- |
| 3166 ms |   188 ms | assets/index-*.js |
| 3015 ms |    75 ms | assets/index-*.js |
| 3381 ms |    55 ms | assets/index-*.js |
| 3112 ms |    54 ms | assets/index-*.js |

`bootup-time`: shell chunk 1624 ms on the main thread (512 ms scripting),
`PentecostParallax-*.js` 832 ms (540 ms scripting), `index.html` 200 ms.
`mainthread-work-breakdown`: 2.8 s — script evaluation 1077 ms, other
967 ms, style and layout 490 ms, rendering 250 ms. `dom-size`: 1,123
elements. `unused-javascript`: 107 KiB estimated.

## Re-running

```bash
pnpm build && pnpm lighthouse
```

Reports land in `.lighthouseci/<profile>/`; the entry with
`isRepresentativeRun: true` in its `manifest.json` is the median run
(tools/README.md).
