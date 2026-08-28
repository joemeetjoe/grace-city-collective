import { describe, expect, it, vi } from "vitest";

import { publishContent } from "./publish";
import { site } from "@/content/site";

function respond(status: number, body: string) {
  return vi.fn(async () => new Response(body, { status, headers: { "content-type": "application/json" } }));
}

describe("publishContent", () => {
  it("PUTs the content as JSON with the bearer token", async () => {
    const fetchImpl = respond(200, JSON.stringify({ ok: true }));
    await expect(publishContent("https://api.example.com", "tok", site, fetchImpl)).resolves.toEqual({ ok: true });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/content");
    expect(init.method).toBe("PUT");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(site);
  });

  it("returns the server's readable errors on 400", async () => {
    const fetchImpl = respond(400, JSON.stringify({ ok: false, errors: ["scene[2].heading: expected string"] }));
    await expect(publishContent("https://api.example.com", "tok", site, fetchImpl)).resolves.toEqual({
      ok: false,
      errors: ["scene[2].heading: expected string"],
    });
  });

  it("explains a 401 in plain words", async () => {
    const fetchImpl = respond(401, JSON.stringify({ message: "Unauthorized" }));
    const result = await publishContent("https://api.example.com", "tok", site, fetchImpl);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/sign in again/i);
  });

  it("reports a non-JSON failure by status", async () => {
    const fetchImpl = respond(502, "Bad Gateway");
    const result = await publishContent("https://api.example.com", "tok", site, fetchImpl);
    expect(result).toEqual({ ok: false, errors: ["the server answered 502"] });
  });

  it("reports a network failure", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const result = await publishContent("https://api.example.com", "tok", site, fetchImpl);
    expect(result).toEqual({ ok: false, errors: ["could not reach the server: TypeError: Failed to fetch"] });
  });
});
