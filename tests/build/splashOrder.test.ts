import { describe, expect, it } from "vitest";

import { splashPrecedesBodyScripts } from "./splashOrder";

const page = (body: string) =>
  `<!doctype html><html><head><script type="module" src="/a.js"></script>` +
  `<script>preload()</script></head><body>${body}</body></html>`;

const splash = `<div data-intro-static="" style="position:fixed"><svg></svg></div>`;

describe("splashPrecedesBodyScripts", () => {
  it("is false when a body script comes before the splash", () => {
    expect(splashPrecedesBodyScripts(page(`<script>x()</script>${splash}<div id="root"></div>`))).toBe(false);
  });

  it("is false when the body has no splash at all", () => {
    expect(splashPrecedesBodyScripts(page(`<div id="root"></div>`))).toBe(false);
  });

  it("is true when the splash is the first thing in the body, before its own script", () => {
    expect(splashPrecedesBodyScripts(page(`${splash}<script>y()</script><div id="root"></div>`))).toBe(true);
  });

  it("ignores scripts in the head: nothing there paints", () => {
    expect(splashPrecedesBodyScripts(page(`${splash}<div id="root"></div>`))).toBe(true);
  });

  it("does not count a splash in the head", () => {
    const html = `<html><head>${splash}</head><body><script>x()</script></body></html>`;
    expect(splashPrecedesBodyScripts(html)).toBe(false);
  });
});
