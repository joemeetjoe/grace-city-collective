import { afterEach, describe, expect, it, vi } from "vitest";

import { loadSiteContent } from "./load";
import { site } from "./site";

const URL = "/content/site.json";

function respond(status: number, body: string): typeof fetch {
  return vi.fn(async () => new Response(body, { status, headers: { "content-type": "application/json" } }));
}

afterEach(() => vi.restoreAllMocks());

describe("loadSiteContent", () => {
  it("resolves the fetched content when it validates", async () => {
    const edited = { ...site, name: "Grace City, edited" };
    const fetchImpl = respond(200, JSON.stringify(edited));
    await expect(loadSiteContent(fetchImpl, URL)).resolves.toEqual(edited);
    expect(fetchImpl).toHaveBeenCalledWith(URL, expect.objectContaining({ cache: "no-cache" }));
  });

  it("falls back to the built-in content, with a warning, on a network error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(loadSiteContent(fetchImpl, URL)).resolves.toBe(site);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0].join(" ")).toMatch(/Failed to fetch/);
  });

  it("falls back, with a warning, on a non-2xx status", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(loadSiteContent(respond(500, "boom"), URL)).resolves.toBe(site);
    expect(warn.mock.calls[0].join(" ")).toMatch(/500/);
  });

  it("treats 404 as 'nothing published yet' and stays quiet", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(loadSiteContent(respond(404, ""), URL)).resolves.toBe(site);
    expect(warn).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledOnce();
  });

  it("falls back, with a warning, on invalid JSON", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(loadSiteContent(respond(200, "{not json"), URL)).resolves.toBe(site);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("falls back, listing the validator's errors, when the JSON has the wrong shape", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const bad = { ...site, name: 7 };
    await expect(loadSiteContent(respond(200, JSON.stringify(bad)), URL)).resolves.toBe(site);
    expect(warn.mock.calls[0].join(" ")).toMatch(/name: expected string/);
  });
});
