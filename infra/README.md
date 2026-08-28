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
