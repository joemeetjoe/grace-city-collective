/**
 * Lambda entry for `PUT /content` behind the HTTP API in infra/editor.yml.
 *
 * Everything decidable is in handlePut.ts; this file only turns the API
 * Gateway v2 event into its input and the two effects into SDK calls. The
 * AWS SDK v3 clients ship inside the nodejs22.x runtime, so they are
 * externals of the bundle (vite.editor.config.ts) and not dependencies here.
 */

import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { handlePut, type HttpResult, type Invalidate, type PutObject } from "./handlePut";

type ApiGatewayV2Event = {
  body?: string;
  isBase64Encoded?: boolean;
  requestContext?: { authorizer?: unknown };
};

const bucket = process.env.SITE_BUCKET ?? "";
const distributionId = process.env.DISTRIBUTION_ID ?? "";

const s3 = new S3Client({});
const cloudfront = new CloudFrontClient({});

const putObject: PutObject = async ({ key, body, contentType, cacheControl }) => {
  await s3.send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: cacheControl }),
  );
};

const invalidate: Invalidate = async (paths) => {
  await cloudfront.send(
    new CreateInvalidationCommand({
      DistributionId: distributionId,
      InvalidationBatch: { CallerReference: `editor-${Date.now()}`, Paths: { Quantity: paths.length, Items: paths } },
    }),
  );
};

export async function handler(event: ApiGatewayV2Event): Promise<HttpResult> {
  const raw = event.body ?? "";
  const body = event.isBase64Encoded ? Buffer.from(raw, "base64").toString("utf8") : raw;
  return handlePut({ body, authorizer: event.requestContext?.authorizer, putObject, invalidate });
}
