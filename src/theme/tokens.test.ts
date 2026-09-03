import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { contrastRatio, cssVar, rgba, tokens, glslVec3 } from "./tokens";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(p)) out.push(p);
  }
  return out;
}

describe("seal tokens", () => {
  it("keep cream label text legible on the filled crimson buttons (WCAG AA)", () => {
    expect(contrastRatio(tokens.cream, tokens.seal)).toBeGreaterThanOrEqual(4.5);
  });

  it("are the only source of the accent colour in src/", () => {
    const src = join(__dirname, "..");
    const offenders = walk(src)
      .filter((p) => !p.endsWith("tokens.ts") && !p.endsWith("tokens.test.ts") && !p.endsWith("index.css"))
      .filter((p) => {
        const text = readFileSync(p, "utf8").toLowerCase();
        return Object.values(tokens).some((hex) => text.includes(hex.toLowerCase()));
      });
    expect(offenders).toEqual([]);
  });

  it("are declared with the same values in the Tailwind theme", () => {
    const css = readFileSync(join(__dirname, "..", "index.css"), "utf8");
    for (const [name, hex] of Object.entries(tokens)) {
      expect(css).toMatch(new RegExp(`${cssVar(name as keyof typeof tokens)}:\\s*${hex};`));
    }
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#d67f48", "#d67f48")).toBe(1);
  });
});

describe("rgba", () => {
  it("writes a token with an alpha as gsap reads it: the ink with none, for a fade from it", () => {
    expect(rgba(tokens.ink, 0)).toBe("rgba(20, 16, 14, 0)");
    expect(rgba(tokens.cream, 0.5)).toBe("rgba(249, 244, 237, 0.5)");
  });
});

describe("glslVec3", () => {
  it("writes a token as a GLSL vec3 literal, channels 0..1", () => {
    expect(glslVec3("#d67f48")).toBe("vec3(0.839, 0.498, 0.282)");
    expect(glslVec3("#ffffff")).toBe("vec3(1.000, 1.000, 1.000)");
  });

  it("can normalise so the brightest channel is 1 — a tint that never darkens", () => {
    expect(glslVec3("#d67f48", { normalise: true })).toBe("vec3(1.000, 0.593, 0.336)");
  });
});
