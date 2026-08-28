import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { EMBERS_SIDE, FRONT_CUTS, STACK, assignLayer, canvasFor, layerMask, renderPasses } from "./layerSplit";
import { parseCuts } from "./parallaxRelief";

const cuts = parseCuts(JSON.parse(readFileSync(resolve(__dirname, "../../public/dore/2048/cuts.json"), "utf8")));
const byName = (name: string) => cuts.find((c) => c.name === name)!;

describe("canvasFor", () => {
  it("puts the floor and the two nearest apostles on the left on the front canvas", () => {
    for (const name of ["floor", "fig13", "fig5"]) expect(canvasFor(byName(name)), name).toBe("front");
    expect([...FRONT_CUTS].sort()).toEqual(["fig13", "fig5", "floor"]);
  });

  it("keeps the backdrop, crowd, arch, dove and the mid apostles on the back canvas", () => {
    for (const name of ["crowd", "arch", "dove", "fig0", "fig1", "fig7", "fig12"]) {
      expect(canvasFor(byName(name)), name).toBe("back");
    }
  });

  it("keeps the praying apostle back: its robe would hide the wordmark's first letter", () => {
    expect(byName("fig10").z).toBe(byName("fig5").z);
    expect(canvasFor(byName("fig10"))).toBe("back");
  });

  it("every flame stays on the back canvas, the three over front figures included", () => {
    for (const c of cuts.filter((c) => c.isFlame)) expect(canvasFor(c), c.name).toBe("back");
    expect(byName("flame5").parent).toBe("fig5");
    expect(byName("flame6").parent).toBe("fig13");
    expect(byName("flame8").parent).toBe("fig10");
  });

  it("the front side is the floor, fig13 and fig5, nothing else", () => {
    const front = cuts.filter((c) => canvasFor(c) === "front").map((c) => c.name);
    expect(front.sort()).toEqual(["fig13", "fig5", "floor"]);
  });

  it("every front cut sits at least as near as every back cut, so the DOM composite keeps the draw order", () => {
    const z = (side: "front" | "back") => cuts.filter((c) => canvasFor(c) === side).map((c) => c.z);
    expect(Math.min(...z("front"))).toBeGreaterThanOrEqual(Math.max(...z("back")));
  });

  it("the embers drift on the front canvas", () => {
    expect(EMBERS_SIDE).toBe("front");
  });
});

describe("layerMask / assignLayer", () => {
  it("maps the two canvases to distinct three.js layer indices", () => {
    expect(layerMask("back")).toBe(0);
    expect(layerMask("front")).toBe(1);
  });

  it("a mesh assigned to one side is drawn by that side's camera mask only", () => {
    const mesh = new THREE.Mesh();
    assignLayer(mesh, "front");
    const camera = new THREE.PerspectiveCamera();
    camera.layers.set(layerMask("back"));
    expect(mesh.layers.test(camera.layers)).toBe(false);
    camera.layers.set(layerMask("front"));
    expect(mesh.layers.test(camera.layers)).toBe(true);
  });

  it("a fresh object sits on the back layer by default", () => {
    const camera = new THREE.PerspectiveCamera();
    camera.layers.set(layerMask("back"));
    expect(new THREE.Mesh().layers.test(camera.layers)).toBe(true);
  });
});

describe("renderPasses", () => {
  it("renders each pass with the camera masked to that pass's layer", () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();
    const back = assignLayer(new THREE.Mesh(), "back");
    const front = assignLayer(new THREE.Mesh(), "front");
    const seen: Array<{ side: string; back: boolean; front: boolean }> = [];
    const fake = (side: string) => ({
      render: (_s: THREE.Scene, c: THREE.Camera) =>
        seen.push({ side, back: back.layers.test(c.layers), front: front.layers.test(c.layers) }),
    });
    renderPasses(scene, camera, [
      { side: "back", renderer: fake("back") },
      { side: "front", renderer: fake("front") },
    ]);
    expect(seen).toEqual([
      { side: "back", back: true, front: false },
      { side: "front", back: false, front: true },
    ]);
  });

  it("with one pass everything assigned to it is drawn and nothing else", () => {
    const camera = new THREE.PerspectiveCamera();
    const back = assignLayer(new THREE.Mesh(), "back");
    let drawn = 0;
    renderPasses(new THREE.Scene(), camera, [
      { side: "back", renderer: { render: (_s, c) => void (drawn += back.layers.test(c.layers) ? 1 : 0) } },
    ]);
    expect(drawn).toBe(1);
  });
});

describe("STACK", () => {
  const z = (cls: string) => Number(/z-\[?(\d+)\]?/.exec(cls)![1]);

  it("orders the page: back canvas, headline and rules, handoff, wordmark, front canvas, copy, nav", () => {
    expect(z(STACK.back)).toBeLessThan(z(STACK.between));
    expect(z(STACK.between)).toBeLessThan(STACK.handoff);
    expect(STACK.handoff).toBeLessThan(z(STACK.wordmark));
    expect(z(STACK.wordmark)).toBeLessThan(z(STACK.front));
    expect(z(STACK.front)).toBeLessThan(z(STACK.copy));
    expect(z(STACK.copy)).toBeLessThan(z(STACK.nav));
  });
});
