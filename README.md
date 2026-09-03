# Grace City Collective

A single-page site for Grace City Collective: an animated intro (seal and
lockup), then Gustave Doré's *The Descent of the Holy Spirit* cut into depth
layers and driven by scroll as a parallax scene.

**Demo (GitHub Pages, deployed by hand):**
https://joemeetjoe.github.io/grace-city-collective/

## Develop

```bash
pnpm install
pnpm dev      # Vite dev server
pnpm test     # Vitest
pnpm lint     # ESLint
pnpm build    # tsc + Vite → dist/
pnpm budget   # static byte budget over dist/ (tools/perf/budget.json)
```

Vite 8, React 19, TypeScript, Tailwind 4, three.js, gsap. CI
(`.github/workflows/ci.yml`) runs lint, test, build and the byte budget on
every pull request and push to main.

## Base path

Every asset URL is resolved by Vite at build time: the Doré textures are
imported through `import.meta.glob` in `src/device/textureManifest.ts`, so
each lands in `dist/assets/` under a content-hashed name with `base` already
prefixed (`textureUrl(width, file)` returns the finished URL). Nothing is
requested by a hand-built path. `base` comes from `BASE_PATH` at build time
and defaults to `/`:

```bash
pnpm build                                  # CloudFront / custom domain:  /
BASE_PATH=/grace-city-collective/ pnpm build # project Pages URL
```

## Deploy

Production is S3 + CloudFront, pushed from GitHub Actions on every push to
`main` (`.github/workflows/deploy.yml`). The GitHub Pages workflow
(`pages.yml`) is `workflow_dispatch` only and still works for the demo URL.

### One-time bootstrap

The infrastructure is a CloudFormation template, `infra/site.yml` (private
bucket + OAC, CloudFront, GitHub OIDC deploy role). Full detail in
[`infra/README.md`](infra/README.md); the short version:

```bash
aws cloudformation deploy \
  --template-file infra/site.yml \
  --stack-name grace-city-site \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides GitHubOwner=joemeetjoe GitHubRepo=grace-city-collective GitHubBranch=main

aws cloudformation describe-stacks --stack-name grace-city-site \
  --query "Stacks[0].Outputs" --output table
```

Then, from the stack outputs, set one repo secret and two repo variables:

| Kind     | Name                         | From output        |
| -------- | ---------------------------- | ------------------ |
| secret   | `AWS_ROLE_ARN`               | `DeployRoleArn`    |
| variable | `S3_BUCKET`                  | `BucketName`       |
| variable | `CLOUDFRONT_DISTRIBUTION_ID` | `DistributionId`   |

Until those exist the workflow exits early with a notice rather than failing.

### Pipeline

1. `pnpm install --frozen-lockfile` → `pnpm build` with `BASE_PATH=/`.
2. Assume the deploy role via OIDC (`aws-actions/configure-aws-credentials`);
   no access keys are stored anywhere.
3. `aws s3 sync dist/assets/` with `--delete` and
   `Cache-Control: public, max-age=31536000, immutable` — bundles, fonts and
   the Doré textures are all content-hashed, so they can be cached forever.
4. `aws s3 sync dist/` for the few unfingerprinted files left (favicon,
   apple-touch-icon) with `max-age=86400`, excluding `assets/` and
   `index.html`.
5. `aws s3 cp dist/index.html` last, with `max-age=60, must-revalidate`.
6. `aws cloudfront create-invalidation --paths / /index.html`.

CloudFront uses the managed `CachingOptimized` policy, which honours those
per-object headers and serves brotli/gzip. Check in the Network panel:
`content-encoding: br`, `cache-control` as above, `x-cache: Hit from
cloudfront` on the second load.

### Custom domain

Request an ACM certificate **in us-east-1**, validate it by DNS, then re-run
the `deploy` command with `DomainName=… AcmCertificateArn=…` added to the
overrides and point DNS (ALIAS/CNAME) at the `DistributionDomainName` output.
`BASE_PATH` stays `/`.

### Cost

S3 + CloudFront only, no compute; the free tier covers this site many times
over (expected run rate < $1/month). Billing → Cost Explorer, grouped by
service, shows the actual number after the first week.

## Recut toolchain

The Doré layers in `src/assets/dore/` are produced by the standalone
[dore-recut](https://github.com/joemeetjoe/dore-recut) project (formerly
`tools/recut` here; SAM segmentation, depth baking, SDXL inpainting of
occluded figures). Regenerate there and copy its `out/dore/{2048,1024}`
over `src/assets/dore/{2048,1024}` — same file names, no renaming; the
build fingerprints them. `tools/shots/cdp-shot.mjs` takes
headless-Chrome screenshots of the scene at scroll waypoints,
`tools/perf/transfer.mjs` (`pnpm transfer`) measures the bytes each tier
sends over the wire on a cold and a warm load (baseline and how to read it
in [`docs/perf/`](docs/perf/README.md)), and
`tools/shots/mobile-check.mjs` is the standing mobile guard: it loads the
built site at the four phone/tablet sizes (375×667, 390×844, 430×932 at
dpr 3; 768×1024 at dpr 2) and fails if the page is ever wider than the
viewport at the top or at any section's top (`node tools/shots/mobile-check.mjs
--url http://localhost:4173/`). [`tools/README.md`](tools/README.md) indexes
these scripts and the build-output tests under `tests/build/`, which read
`dist/` after a build (`pnpm test:build`).
