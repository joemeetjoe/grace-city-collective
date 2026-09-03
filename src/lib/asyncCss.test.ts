import { describe, expect, it } from "vitest";

import { asyncCssLinks, isStylesheetLink } from "./asyncCss";

const link = `<link rel="stylesheet" crossorigin href="/assets/index-Dlyn5I9Z.css">`;
const page = (head: string, body = `<div id="root"></div>`) =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;

describe("isStylesheetLink", () => {
  it("recognises Vite's stylesheet link", () => {
    expect(isStylesheetLink(link)).toBe(true);
  });

  it("recognises the rel in any position, quoted or bare", () => {
    expect(isStylesheetLink(`<link href="/a.css" rel=stylesheet>`)).toBe(true);
    expect(isStylesheetLink(`<link href="/a.css" rel='stylesheet'>`)).toBe(true);
  });

  it("ignores other links and other tags", () => {
    expect(isStylesheetLink(`<link rel="icon" type="image/svg+xml" href="/favicon.svg">`)).toBe(false);
    expect(isStylesheetLink(`<link rel="preload" as="style" href="/a.css">`)).toBe(false);
    expect(isStylesheetLink(`<link rel="modulepreload" href="/a.js">`)).toBe(false);
    expect(isStylesheetLink(`<script src="/a.js"></script>`)).toBe(false);
  });
});

describe("asyncCssLinks", () => {
  it("turns the stylesheet link into a preload that becomes a stylesheet on load, with a noscript fallback", () => {
    const html = asyncCssLinks(page(`<script type="module" crossorigin src="/assets/index.js"></script>${link}`));
    expect(html).toContain(
      `<link rel="preload" as="style" crossorigin href="/assets/index-Dlyn5I9Z.css" onload="this.onload=null;this.rel='stylesheet'">` +
        `<noscript>${link}</noscript>`,
    );
    expect(html).not.toMatch(/<link rel="stylesheet"[^>]*>(?!<\/noscript>)/);
  });

  it("keeps every other attribute of the link, in place", () => {
    const html = asyncCssLinks(page(`<link href="/a.css" rel="stylesheet" media="all">`));
    expect(html).toContain(`<link href="/a.css" rel="preload" as="style" media="all" onload="this.onload=null;this.rel='stylesheet'">`);
    expect(html).toContain(`<noscript><link href="/a.css" rel="stylesheet" media="all"></noscript>`);
  });

  it("leaves the rest of the page alone", () => {
    const before = page(`<link rel="icon" href="/favicon.svg"><style>html{background:#000}</style>${link}`);
    const after = asyncCssLinks(before);
    expect(after.startsWith(`<!doctype html><html><head><link rel="icon" href="/favicon.svg"><style>html{background:#000}</style>`)).toBe(true);
    expect(after.endsWith(`</head><body><div id="root"></div></body></html>`)).toBe(true);
  });

  it("does not touch a stylesheet link already inside a noscript", () => {
    const html = page(`<noscript>${link}</noscript>`);
    expect(asyncCssLinks(html)).toBe(html);
  });

  it("rewrites every blocking stylesheet, not only the first", () => {
    const html = asyncCssLinks(page(`<link rel="stylesheet" href="/a.css"><link rel="stylesheet" href="/b.css">`));
    expect(html.match(/rel="preload" as="style"/g)).toHaveLength(2);
    expect(html.match(/<noscript>/g)).toHaveLength(2);
  });

  it("is the identity on a page with no stylesheet link", () => {
    const html = page(`<script type="module" src="/a.js"></script>`);
    expect(asyncCssLinks(html)).toBe(html);
  });
});
