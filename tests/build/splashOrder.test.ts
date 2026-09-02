import { describe, expect, it } from "vitest";

import {
  blockingStylesheets,
  inlineStylePrecedesHeadScripts,
  splashPrecedesBodyScripts,
  staticSplashHeadlines,
  staticSplashOf,
} from "./splashOrder";

const page = (body: string, head = `<script type="module" src="/a.js"></script><script>preload()</script>`) =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

const splash = `<div data-intro-static="" style="position:fixed"><svg></svg></div>`;
const sheet = `<link rel="stylesheet" crossorigin href="/assets/index.css">`;
const preload = `<link rel="preload" as="style" crossorigin href="/assets/index.css" onload="this.onload=null;this.rel='stylesheet'">`;

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

describe("staticSplashOf", () => {
  it("is the splash's markup up to its own script, and nothing after", () => {
    expect(staticSplashOf(page(`${splash}<script>y()</script><div id="root"></div>`))).toBe(splash);
  });

  it("runs to the end of the body when no script follows", () => {
    expect(staticSplashOf(page(`${splash}<div id="root"></div>`))).toBe(`${splash}<div id="root"></div>`);
  });

  it("is empty without a splash in the body", () => {
    expect(staticSplashOf(page(`<div id="root"></div>`))).toBe("");
  });
});

describe("staticSplashHeadlines", () => {
  const withH1 = `<div data-intro-static="" style="position:fixed"><svg></svg><div><h1 data-splash-headline="">Bread &amp; wine</h1></div></div>`;

  it("reads the h1 in the splash, entities decoded", () => {
    expect(staticSplashHeadlines(page(`${withH1}<script>y()</script><h1>later</h1>`))).toEqual(["Bread & wine"]);
  });

  it("is empty for a splash without one", () => {
    expect(staticSplashHeadlines(page(`${splash}<script>y()</script><h1>later</h1>`))).toEqual([]);
  });
});

describe("blockingStylesheets", () => {
  it("lists a stylesheet link in the head", () => {
    expect(blockingStylesheets(page("", `<style>html{}</style>${sheet}`))).toEqual([sheet]);
  });

  it("is empty when the stylesheet is a preload with the link in a noscript", () => {
    expect(blockingStylesheets(page("", `${preload}<noscript>${sheet}</noscript>`))).toEqual([]);
  });

  it("is empty with no stylesheet at all", () => {
    expect(blockingStylesheets(page(""))).toEqual([]);
  });

  it("counts a stylesheet link in the body too: it blocks what follows it", () => {
    expect(blockingStylesheets(page(`${splash}${sheet}`, ""))).toEqual([sheet]);
  });

  it("ignores links that are not stylesheets", () => {
    expect(blockingStylesheets(page("", `<link rel="icon" href="/favicon.svg"><link rel="modulepreload" href="/a.js">`))).toEqual([]);
  });
});

describe("inlineStylePrecedesHeadScripts", () => {
  it("is true when a <style> comes before every script in the head", () => {
    expect(inlineStylePrecedesHeadScripts(page("", `<style>html{background:#000}</style><script type="module" src="/a.js"></script>`))).toBe(true);
  });

  it("is true when the head has a <style> and no script", () => {
    expect(inlineStylePrecedesHeadScripts(page("", `<style>html{}</style>`))).toBe(true);
  });

  it("is false when a script comes first", () => {
    expect(inlineStylePrecedesHeadScripts(page("", `<script>x()</script><style>html{}</style>`))).toBe(false);
  });

  it("is false with no inline style in the head at all", () => {
    expect(inlineStylePrecedesHeadScripts(page("", `<script>x()</script>`))).toBe(false);
    expect(inlineStylePrecedesHeadScripts(page(`<style>html{}</style>`, ""))).toBe(false);
  });

  it("does not count a <style> inside a noscript", () => {
    expect(inlineStylePrecedesHeadScripts(page("", `<noscript><style>html{}</style></noscript><script>x()</script>`))).toBe(false);
  });
});
