# infra

`site.yml` is a single CloudFormation template for the permanent host:

- **S3 bucket** — private (public access blocked, bucket-owner-enforced
  ACLs, SSE-S3). Only CloudFront can read it, via Origin Access Control.
- **CloudFront distribution** — HTTPS redirect, HTTP/2 + HTTP/3, brotli/gzip,
  `index.html` as the root object, `PriceClass_100` (NA + EU edges), managed
  `CachingOptimized` cache policy and `SecurityHeadersPolicy` response
  headers. Cache lifetimes come from the `Cache-Control` the deploy workflow
  sets per object, not from CloudFront.
- **GitHub OIDC** — an identity provider for
  `token.actions.githubusercontent.com` (skippable) and a deploy role whose
  trust policy only accepts tokens from
  `repo:<owner>/<repo>:ref:refs/heads/<branch>`. Its inline policy is limited
  to listing/putting/getting/deleting objects in the bucket and creating
  invalidations on the distribution. No long-lived keys anywhere.

Why CloudFormation rather than CDK/Terraform: neither CLI is installed, a CDK
app would add npm dependencies to a repo that has no server-side code, and
the whole stack is ~200 lines of declarative YAML. The template is
self-contained and needs only the AWS CLI.

## One-time bootstrap

Run from the repo root with credentials for the target account. Region is
whatever `aws configure get region` says; the certificate (if any) must be in
`us-east-1` regardless.

```bash
aws cloudformation validate-template --template-body file://infra/site.yml

aws cloudformation deploy \
  --template-file infra/site.yml \
  --stack-name grace-city-site \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides \
    GitHubOwner=joemeetjoe \
    GitHubRepo=grace-city-collective \
    GitHubBranch=main

aws cloudformation describe-stacks --stack-name grace-city-site \
  --query "Stacks[0].Outputs" --output table
```

If the account already has a GitHub OIDC provider (`aws iam
list-open-id-connect-providers`), add `CreateOidcProvider=false` to the
overrides; the role will reference the existing one.

Then wire the outputs into the repository (Settings → Secrets and variables →
Actions), or with the CLI:

```bash
gh secret set AWS_ROLE_ARN --body "<DeployRoleArn>"
gh variable set S3_BUCKET --body "<BucketName>"
gh variable set CLOUDFRONT_DISTRIBUTION_ID --body "<DistributionId>"
```

`AWS_ROLE_ARN` is the only secret. Bucket name and distribution id are plain
variables. Until all three exist the deploy workflow exits early with a
notice instead of failing.

Run `Deploy to AWS` from the Actions tab (or push to `main`). The site is at
the `SiteUrl` output.

## Custom domain

1. Request a certificate **in us-east-1** for the domain (and `www.` if
   wanted) and validate it via DNS:
   `aws acm request-certificate --region us-east-1 --domain-name example.org --validation-method DNS`
2. Re-run the `deploy` command above with
   `DomainName=example.org AcmCertificateArn=arn:aws:acm:us-east-1:...`
   appended to `--parameter-overrides`. The stack switches on the alias and
   the TLS certificate; nothing else changes.
3. Point DNS at the `DistributionDomainName` output: an ALIAS record in
   Route 53, or a CNAME elsewhere.

Vite's `base` is already `/`, so no rebuild is needed.

## Updating / tearing down

Edit `site.yml` and re-run the same `deploy` command; CloudFormation applies
the diff. `aws cloudformation delete-stack --stack-name grace-city-site`
removes everything except the bucket, which has `DeletionPolicy: Retain` so a
mistaken delete does not lose the built site; empty and delete it by hand.

## Cost

S3 + CloudFront only; no compute. `dist/` is ~13 MB. The always-free tier
covers 1 TB/month of CloudFront egress, 10 M requests, 1,000 invalidation
paths, and the S3 storage is cents. Expect a run rate under $1/month. Check
with Cost Explorer (Billing → Cost Explorer, filter by service) or:

```bash
aws ce get-cost-and-usage --time-period Start=$(date -v-7d +%F),End=$(date +%F) \
  --granularity DAILY --metrics UnblendedCost --group-by Type=DIMENSION,Key=SERVICE
```

## Content editor (`editor.yml`)

The words on the page are data (`src/content/site.ts`). At runtime the site
fetches `content/site.json` from the same CloudFront distribution and swaps
it in; if that object is missing, unreachable, not JSON, or the wrong shape,
the built-in words render and a console line says why. The page never waits
on the fetch: it paints with the built-in content and re-renders when the
published JSON arrives (usually under the intro).

`editor.yml` is a second, independent stack that lets an editor change that
JSON from `/admin.html` without a rebuild:

- **Cognito user pool** — email sign-in, no self-signup, 12-char mixed
  password policy, one app client (no secret, `USER_PASSWORD_AUTH`). The
  first editor is created from the `EditorEmail` parameter and gets a
  temporary password by email; more editors with
  `aws cognito-idp admin-create-user`.
- **HTTP API** (API Gateway v2) — `PUT /content` behind a JWT authorizer
  whose issuer is the pool and audience the client id. Anything without a
  valid id token is refused by the gateway (401) before the function runs.
  CORS is restricted to `AllowedOrigin`, the origin the admin page lives on.
  Throttled to 2 req/s, burst 5.
- **Lambda** (`nodejs22.x`, arm64, 256 MB, 10 s) — validates the body
  against the `SiteContent` shape (`src/content/schema.ts`, the same
  validator the site uses on load) and answers 400 with every problem as
  `path: reason`; a valid document is written to `content/site.json` with
  `Cache-Control: public, max-age=60` and `/content/site.json` is
  invalidated, so an edit is live within a minute. Bodies over 512 KB are
  refused (413). Its role may only `s3:PutObject` on `content/*` in the site
  bucket and create invalidations on the one distribution. As a defence in
  depth it also refuses any request that carries no authorizer context.

The deploy workflow excludes `content/*` from its `--delete` sync, so a push
to `main` never removes what an editor published.

### Bootstrap

Prerequisites: the site stack is deployed (`BucketName`, `DistributionId`,
`SiteUrl` outputs above).

1. Deploy the editor stack. `AllowedOrigin` is the site's origin with no
   trailing slash (the `SiteUrl` output minus the `/`):

   ```bash
   aws cloudformation validate-template --template-body file://infra/editor.yml

   aws cloudformation deploy \
     --template-file infra/editor.yml \
     --stack-name grace-city-editor \
     --capabilities CAPABILITY_IAM \
     --parameter-overrides \
       SiteBucketName=<BucketName> \
       DistributionId=<DistributionId> \
       AllowedOrigin=https://d1234abcd.cloudfront.net \
       EditorEmail=someone@example.org

   aws cloudformation describe-stacks --stack-name grace-city-editor \
     --query "Stacks[0].Outputs" --output table
   ```

   Cognito emails the temporary password to `EditorEmail` as soon as the
   user is created (valid 7 days).

2. Upload the function code. The template ships a placeholder that answers
   503 "editor code not deployed"; the real bundle is built from
   `infra/editor/handler.ts`:

   ```bash
   pnpm build:editor   # → infra/editor/dist/handler.zip (index.mjs inside)
   aws lambda update-function-code \
     --function-name <FunctionName output> \
     --zip-file fileb://infra/editor/dist/handler.zip
   ```

   Repeat this step whenever `handler.ts`, `handlePut.ts`, or
   `src/content/schema.ts` changes. Re-running `cloudformation deploy` does
   not overwrite uploaded code unless the template's placeholder changes.

3. Give the admin page its connection details. They are baked in at build
   time from `VITE_EDITOR_*` variables, which the deploy workflow reads from
   repository variables:

   ```bash
   gh variable set EDITOR_API_URL --body "<ApiUrl output>"
   gh variable set EDITOR_REGION --body "<Region output>"
   gh variable set EDITOR_USER_POOL_ID --body "<UserPoolId output>"
   gh variable set EDITOR_CLIENT_ID --body "<ClientId output>"
   ```

   Then run `Deploy to AWS` (or push to `main`). Without them `/admin.html`
   still builds and shows "Editor not configured" with the missing names.
   For a local build put the same four names, prefixed `VITE_`, in
   `.env.local` (gitignored via `*.local`).

4. First sign-in: open `https://<site>/admin.html`, enter the email and the
   temporary password; the page asks for a new one, then shows the form.
   Edit, press **Publish**. The site reflects it within a minute. The id
   token lives in memory only and lasts an hour; after that Publish answers
   "sign in again" and returns to the sign-in form with the edits kept.

### `/admin` vs `/admin.html`

The page is built as `admin.html`, and CloudFront + S3 serve it at that
exact path. `/admin` would need a rewrite (a CloudFront Function on the
viewer-request event that appends `.html`, added to `site.yml`). The link
is `/admin.html` for now; the rewrite is a later, optional change. The page
is `noindex`.

### Cost

Everything here is inside always-free tiers: Cognito (10,000 MAU),
API Gateway HTTP APIs (1 M requests/month for 12 months, then ~$1 per
million), Lambda (1 M requests and 400,000 GB-s/month). A handful of edits a
week rounds to $0; the site's total run rate stays under $1/month.

### Updating / tearing down

`aws cloudformation delete-stack --stack-name grace-city-editor` removes the
pool, API, and function; `content/site.json` stays in the site bucket and
keeps being served (delete it with `aws s3 rm` to fall back to the built-in
words). The site stack is untouched.
