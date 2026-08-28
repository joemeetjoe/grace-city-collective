/**
 * Design sheet for the seal — not a test of behaviour. Renders the component
 * to static markup and writes an HTML page; a headless browser turns it into
 * docs/design/seal/seal-review-sheet.png. Runs only when SEAL_SHEET=1:
 *   SEAL_SHEET=1 pnpm vitest run tools/seal/sheet.test.tsx
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { it } from "vitest";

import Seal from "@/components/Seal";
import { cssVar, tokens, type Token } from "@/theme/tokens";

const vars = (Object.keys(tokens) as Token[]).map((t) => `${cssVar(t)}: ${tokens[t]};`).join(" ");

function cell(label: string, markup: string, scale = 1) {
  return `<figure><div class="art" style="zoom:${scale};image-rendering:pixelated">${markup}</div><figcaption>${label}</figcaption></figure>`;
}

it.skipIf(!process.env.SEAL_SHEET)("writes the seal design sheet", () => {
  const live180 = renderToStaticMarkup(<Seal variant="live" size={180} />);
  const static180 = renderToStaticMarkup(<Seal variant="static" size={180} />);
  const static28 = renderToStaticMarkup(<Seal variant="static" size={28} />);
  const static16 = renderToStaticMarkup(<Seal variant="static" size={16} />);
  const html = `<!doctype html><html><head><style>
    :root { ${vars} }
    body { margin: 0; background: ${tokens.ink}; color: ${tokens.cream}; font: 11px/1.4 -apple-system, sans-serif; letter-spacing: .18em; text-transform: uppercase }
    .row { display: flex; align-items: flex-start; gap: 44px; padding: 40px }
    figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 14px }
    .art { display: block }
  </style></head><body><div class="row">
    ${cell("live · 180px", live180)}
    ${cell("static · 180px", static180)}
    ${cell("static · 28px (×5)", static28, 5)}
    ${cell("static · 16px (×8)", static16, 8)}
    <figure><div class="art" style="display:flex;gap:16px;align-items:center">${static28}${static16}</div><figcaption>actual size</figcaption></figure>
  </div></body></html>`;
  const dir = process.env.SEAL_SHEET_DIR ?? "docs/design/seal";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/seal-review-sheet.html`, html);
});

/**
 * Static assets: public/favicon.svg (hex-resolved, standalone) and an HTML
 * page the same headless browser turns into public/apple-touch-icon.png.
 *   SEAL_ASSETS=1 pnpm vitest run tools/seal/sheet.test.tsx
 */
it.skipIf(!process.env.SEAL_ASSETS)("writes the favicon and touch-icon sources", () => {
  const resolve = (markup: string) =>
    markup.replace(/var\((--color-[a-z-]+), (#[0-9a-f]{6})\)/gi, (_, __, hex: string) => hex);
  const favicon = resolve(renderToStaticMarkup(<Seal variant="static" size={64} title="Grace City Collective" />))
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/ style="[^"]*"/, "");
  writeFileSync("public/favicon.svg", `${favicon}\n`);
  const touch = resolve(renderToStaticMarkup(<Seal variant="static" size={152} title="Grace City Collective" />));
  const dir = process.env.SEAL_SHEET_DIR ?? "docs/design/seal";
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    `${dir}/apple-touch-icon.html`,
    `<!doctype html><html><body style="margin:0;width:180px;height:180px;background:${tokens.ink};display:flex;align-items:center;justify-content:center">${touch}</body></html>`,
  );
  for (const [name, variant, size] of [
    ["hero-180", "live", 180],
    ["nav-28", "static", 28],
    ["favicon-16", "static", 16],
  ] as const) {
    const art = renderToStaticMarkup(<Seal variant={variant} size={size} />);
    writeFileSync(
      `${dir}/seal-${name}.html`,
      `<!doctype html><html><body style="margin:0;background:${tokens.ink};padding:10px;display:inline-block">${art}</body></html>`,
    );
  }
});
