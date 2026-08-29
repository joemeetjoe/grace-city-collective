import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { EMBERS_SIDE, FRONT_CUTS_AT, STACK, assignLayer, canvasFor, frontCutsAt, layerMask, renderPasses, stopAt } from "./layerSplit";
import { bindFlames, parseCuts } from "./parallaxRelief";

const cuts = parseCuts(JSON.parse(readFileSync(resolve(__dirname, "../../public/dore/2048/cuts.json"), "utf8")));
const byName = (name: string) => cuts.find((c) => c.name === name)!;

/**
 * Each cut's mask bounding box in plate fractions [u0, v0, u1, v1] — the
 * figures read off public/dore/1024/masks-cut-*.webp at a threshold of
 * 64/255, the flames off the 2048 tier's masks-flame-*.webp at 16/255
 * (.venv-recut/bin/python, PIL + numpy; tools/shots/mask-bboxes.json holds
 * the same numbers). Two cuts whose boxes are disjoint share no pixels.
 */
const BBOX: Record<string, [number, number, number, number]> = {
  fig0: [0.004, 0.476, 0.178, 0.752],
  fig1: [0.621, 0.497, 0.957, 0.83],
  fig2: [0.143, 0.479, 0.291, 0.8],
  fig3: [0.777, 0.475, 0.99, 0.813],
  fig4: [0.016, 0.517, 0.262, 0.798],
  fig5: [0.1, 0.459, 0.371, 0.822],
  fig6: [0.316, 0.446, 0.482, 0.8],
  fig7: [0.697, 0.478, 0.92, 0.798],
  fig8: [0.504, 0.438, 0.717, 0.798],
  fig9: [0.482, 0.463, 0.611, 0.752],
  fig10: [0.359, 0.43, 0.57, 0.798],
  fig12: [0.672, 0.473, 0.766, 0.8],
  fig13: [0.084, 0.498, 0.422, 0.865],
  crowd: [0, 0.4, 0.998, 0.813],
  dove: [0.455, 0.021, 0.562, 0.048],
  arch: [0.01, 0.048, 0.32, 0.484],
  floor: [0, 0.779, 0.998, 0.998],
  flame0: [0.111, 0.382, 0.121, 0.437],
  flame1: [0.177, 0.448, 0.187, 0.488],
  flame2: [0.184, 0.41, 0.198, 0.483],
  flame3: [0.19, 0.422, 0.193, 0.427],
  flame4: [0.188, 0.444, 0.2, 0.482],
  flame5: [0.295, 0.344, 0.309, 0.426],
  flame6: [0.361, 0.364, 0.378, 0.444],
  flame7: [0.406, 0.375, 0.416, 0.413],
  flame8: [0.479, 0.326, 0.492, 0.402],
  flame9: [0.531, 0.392, 0.541, 0.444],
  flame10: [0.573, 0.326, 0.586, 0.398],
  flame11: [0.628, 0.382, 0.646, 0.464],
  flame12: [0.701, 0.392, 0.715, 0.45],
  flame13: [0.753, 0.368, 0.767, 0.454],
  flame14: [0.882, 0.399, 0.896, 0.447],
};
const disjoint = (a: string, b: string) => {
  const p = BBOX[a];
  const q = BBOX[b];
  return p[2] < q[0] || q[2] < p[0] || p[3] < q[1] || q[3] < p[1];
};

describe("canvasFor", () => {
  it("puts the floor, the two nearest apostles on the left and the nearest on the right on the front canvas", () => {
    for (const name of ["floor", "fig13", "fig5", "fig1"]) expect(canvasFor(byName(name)), name).toBe("front");
    expect([...frontCutsAt(0)].sort()).toEqual(["fig1", "fig13", "fig5", "floor"]);
  });

  it("keeps the backdrop, crowd, arch, dove and the mid apostles on the back canvas", () => {
    for (const name of ["crowd", "arch", "dove", "fig0", "fig4", "fig7", "fig12"]) {
      expect(canvasFor(byName(name)), name).toBe("back");
    }
  });

  it("has one row per scene stop, and a stop past the table takes the last row", () => {
    expect(FRONT_CUTS_AT.length).toBe(6);
    expect(frontCutsAt(99)).toBe(FRONT_CUTS_AT[5]);
    expect(frontCutsAt(-1)).toBe(FRONT_CUTS_AT[0]);
    expect(frontCutsAt(2.7)).toBe(FRONT_CUTS_AT[2]);
  });

  it("on the mobile tier the two left apostles and their flames stay back at every stop; the floor and fig1 hold", () => {
    for (let stop = 0; stop < FRONT_CUTS_AT.length; stop++) {
      for (const name of ["fig13", "fig5", "flame5", "flame6"]) expect(canvasFor(byName(name), stop, "mobile"), `${name} at ${stop}`).toBe("back");
      for (const name of ["floor", "fig1"]) expect(canvasFor(byName(name), stop, "mobile"), `${name} at ${stop}`).toBe("front");
    }
    expect(canvasFor(byName("fig13"), 0, "desktop")).toBe("front");
    expect(canvasFor(byName("flame5"), 1, "desktop")).toBe("front");
  });

  it("the row turns with the camera's frame, at the half of a section", () => {
    expect(stopAt(0)).toBe(0);
    expect(stopAt(0.49)).toBe(0);
    expect(stopAt(0.5)).toBe(1);
    expect(stopAt(1.2)).toBe(1);
    expect(stopAt(-0.3)).toBe(0);
  });

  it("keeps the praying apostle back: its robe would hide the wordmark's first letter", () => {
    expect(byName("fig10").z).toBe(byName("fig5").z);
    expect(canvasFor(byName("fig10"))).toBe("back");
  });

  it("every flame is back at the hero and the visit stops; the two left apostles' flames come forward between", () => {
    for (const stop of [0, 5]) for (const c of cuts.filter((c) => c.isFlame)) expect(canvasFor(c, stop), `${c.name} at ${stop}`).toBe("back");
    for (const stop of [1, 2, 3, 4]) {
      for (const c of cuts.filter((c) => c.isFlame)) {
        expect(canvasFor(c, stop), `${c.name} at ${stop}`).toBe(c.name === "flame5" || c.name === "flame6" ? "front" : "back");
      }
    }
    expect(byName("flame5").parent).toBe("fig5");
    expect(byName("flame6").parent).toBe("fig13");
    expect(byName("flame8").parent).toBe("fig10");
  });

  it("the front side is the floor, fig13, fig5 and fig1 at every stop, plus their two flames from who-we-are to give", () => {
    const figures = ["fig1", "fig13", "fig5", "floor"];
    for (let stop = 0; stop < FRONT_CUTS_AT.length; stop++) {
      const front = cuts.filter((c) => canvasFor(c, stop) === "front").map((c) => c.name);
      const want = stop >= 1 && stop <= 4 ? [...figures, "flame5", "flame6"] : figures;
      expect(front.sort(), `stop ${stop}`).toEqual(want.sort());
    }
  });

  it("a back cut nearer than a front cut shares no pixels with it, so the DOM composite keeps the draw order", () => {
    // a flame rides its parent's plane (bindFlames), which is the z it draws at
    const bound = bindFlames(cuts);
    for (const c of bound) expect(BBOX[c.name], c.name).toBeDefined();
    for (const tier of ["desktop", "mobile"] as const) {
      for (let stop = 0; stop < FRONT_CUTS_AT.length; stop++) {
        const front = bound.filter((c) => canvasFor(c, stop, tier) === "front");
        const back = bound.filter((c) => canvasFor(c, stop, tier) === "back");
        for (const f of front) {
          for (const b of back) {
            if (b.z <= f.z) continue;
            expect(disjoint(f.name, b.name), `${tier} stop ${stop}: ${b.name} (z ${b.z}) over ${f.name} (z ${f.z})`).toBe(true);
          }
        }
      }
    }
    // the one such pair: the praying apostle stays back, beside the right-hand one in front
    expect(byName("fig10").z).toBeGreaterThan(byName("fig1").z);
    expect(disjoint("fig10", "fig1")).toBe(true);
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

  it("orders the page: back canvas, headline and rules, handoff, front canvas, copy, nav", () => {
    expect(z(STACK.back)).toBeLessThan(z(STACK.between));
    expect(z(STACK.between)).toBeLessThan(STACK.handoff);
    expect(STACK.handoff).toBeLessThan(z(STACK.front));
    expect(z(STACK.front)).toBeLessThan(z(STACK.copy));
    expect(z(STACK.copy)).toBeLessThan(z(STACK.nav));
  });
});
