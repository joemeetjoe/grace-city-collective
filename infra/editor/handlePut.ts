/**
 * The editor's write path, minus AWS: takes the request body and two
 * injected effects, returns an HTTP-shaped result. `handler.ts` wires it to
 * S3 and CloudFront; the tests hand it stubs.
 *
 * Order of refusal: no authorizer context (401) → oversize (413) → not JSON
 * (400) → wrong shape (400, with the validator's paths) → write failed (500).
 * Only a valid document is ever written, and only a written document is
 * invalidated.
 */

import { validateSite } from "@/content/schema";

export const CONTENT_KEY = "content/site.json";
export const MAX_BODY_BYTES = 512 * 1024;
export const CACHE_CONTROL = "public, max-age=60";

export type PutObject = (args: { key: string; body: string; contentType: string; cacheControl: string }) => Promise<void>;
export type Invalidate = (paths: string[]) => Promise<void>;
export type PutDeps = { putObject: PutObject; invalidate: Invalidate };

export type PutInput = PutDeps & {
  body: string;
  /** `event.requestContext.authorizer` as API Gateway hands it over; undefined means the JWT authorizer never ran */
  authorizer: unknown;
};

export type HttpResult = { statusCode: number; headers: Record<string, string>; body: string };

function json(statusCode: number, payload: unknown): HttpResult {
  return {
    statusCode,
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}

function refuse(statusCode: number, ...errors: string[]): HttpResult {
  return json(statusCode, { ok: false, errors });
}

export async function handlePut({ body, authorizer, putObject, invalidate }: PutInput): Promise<HttpResult> {
  if (!authorizer || typeof authorizer !== "object") {
    return refuse(401, "not authorized: the request did not pass the JWT authorizer");
  }

  const bytes = new TextEncoder().encode(body).length;
  if (bytes > MAX_BODY_BYTES) {
    return refuse(413, `content is ${bytes} bytes; the limit is ${MAX_BODY_BYTES}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (error) {
    return refuse(400, `body is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const result = validateSite(parsed);
  if (!result.ok) return refuse(400, ...result.errors);

  try {
    await putObject({
      key: CONTENT_KEY,
      body: `${JSON.stringify(result.value, null, 2)}\n`,
      contentType: "application/json; charset=utf-8",
      cacheControl: CACHE_CONTROL,
    });
  } catch (error) {
    return refuse(500, `could not write content: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    await invalidate([`/${CONTENT_KEY}`]);
  } catch (error) {
    // the object is written; the edge just takes up to max-age to notice
    return refuse(500, `content written but not invalidated: ${error instanceof Error ? error.message : String(error)}`);
  }

  return json(200, { ok: true });
}
