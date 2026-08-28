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
```

Vite 8, React 19, TypeScript, Tailwind 4, three.js, gsap.

## Base path

Runtime asset URLs (`public/dore/…`) go through `assetUrl()` in
`src/lib/assetBase.ts`, which prefixes `import.meta.env.BASE_URL`. That value
comes from `BASE_PATH` at build time and defaults to `/`:

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
   `Cache-Control: public, max-age=31536000, immutable` — filenames are
   content-hashed, so they can be cached forever.
4. `aws s3 sync dist/` for everything else (`dore/` textures, icons) with
   `max-age=86400`, excluding `assets/` and `index.html`.
5. `aws s3 cp dist/index.html` last, with `max-age=60, must-revalidate`.
6. `aws cloudfront create-invalidation --paths / /index.html /dore/*`.

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

The Doré layers in `public/dore/` are produced by the Python scripts in
`tools/recut` (SAM segmentation, depth baking, SDXL inpainting of occluded
figures). They expect a `.venv-recut` virtualenv and write scratch output to
`tools/recut/out-*`, both gitignored. `tools/shots/cdp-shot.mjs` takes
headless-Chrome screenshots of the scene at scroll waypoints.
