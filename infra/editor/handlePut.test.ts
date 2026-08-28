import { describe, expect, it, vi } from "vitest";

import { handlePut, MAX_BODY_BYTES, type PutDeps } from "./handlePut";
import { site } from "@/content/site";

const authorizer = { jwt: { claims: { email: "editor@example.com" } } };

function deps(): PutDeps & { putObject: ReturnType<typeof vi.fn>; invalidate: ReturnType<typeof vi.fn> } {
  return { putObject: vi.fn(async () => {}), invalidate: vi.fn(async () => {}) };
}

function parse(body: string): unknown {
  return JSON.parse(body);
}

describe("handlePut", () => {
  it("writes pretty JSON to content/site.json, invalidates it, and answers 200", async () => {
    const d = deps();
    const body = JSON.stringify({ ...site, name: "Edited" });
    const res = await handlePut({ body, authorizer, ...d });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(parse(res.body)).toEqual({ ok: true });

    expect(d.putObject).toHaveBeenCalledOnce();
    const [put] = d.putObject.mock.calls[0] as [{ key: string; body: string; contentType: string; cacheControl: string }];
    expect(put.key).toBe("content/site.json");
    expect(put.contentType).toBe("application/json; charset=utf-8");
    expect(put.cacheControl).toBe("public, max-age=60");
    expect(put.body).toBe(`${JSON.stringify({ ...site, name: "Edited" }, null, 2)}\n`);

    expect(d.invalidate).toHaveBeenCalledWith(["/content/site.json"]);
  });

  it("answers 400 with the validator's errors and writes nothing", async () => {
    const d = deps();
    const body = JSON.stringify({ ...site, name: 3, extra: true });
    const res = await handlePut({ body, authorizer, ...d });

    expect(res.statusCode).toBe(400);
    expect(parse(res.body)).toEqual({ ok: false, errors: ['unknown key "extra"', "name: expected string"] });
    expect(d.putObject).not.toHaveBeenCalled();
    expect(d.invalidate).not.toHaveBeenCalled();
  });

  it("answers 400 on a body that is not JSON", async () => {
    const d = deps();
    const res = await handlePut({ body: "{nope", authorizer, ...d });
    expect(res.statusCode).toBe(400);
    const parsed = parse(res.body) as { ok: boolean; errors: string[] };
    expect(parsed.ok).toBe(false);
    expect(parsed.errors[0]).toMatch(/not valid JSON/);
    expect(d.putObject).not.toHaveBeenCalled();
  });

  it("answers 413 when the body is over the size limit, before parsing", async () => {
    const d = deps();
    const body = `"${"x".repeat(MAX_BODY_BYTES)}"`;
    const res = await handlePut({ body, authorizer, ...d });
    expect(res.statusCode).toBe(413);
    expect(d.putObject).not.toHaveBeenCalled();
  });

  it("answers 401 when no authorizer context reached the function", async () => {
    const d = deps();
    const res = await handlePut({ body: JSON.stringify(site), authorizer: undefined, ...d });
    expect(res.statusCode).toBe(401);
    expect(d.putObject).not.toHaveBeenCalled();
    expect(d.invalidate).not.toHaveBeenCalled();
  });

  it("answers 500 when the write fails, without invalidating", async () => {
    const d = deps();
    d.putObject.mockRejectedValueOnce(new Error("AccessDenied"));
    const res = await handlePut({ body: JSON.stringify(site), authorizer, ...d });
    expect(res.statusCode).toBe(500);
    expect(parse(res.body)).toEqual({ ok: false, errors: ["could not write content: AccessDenied"] });
    expect(d.invalidate).not.toHaveBeenCalled();
  });
});
