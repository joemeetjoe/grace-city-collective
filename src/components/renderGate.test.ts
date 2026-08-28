import { describe, expect, it, vi } from "vitest";

import { createRenderGate } from "./renderGate";

function gate() {
  const start = vi.fn();
  const stop = vi.fn();
  return { start, stop, gate: createRenderGate({ start, stop }) };
}

describe("createRenderGate", () => {
  it("starts the loop when the canvas comes into view, once", () => {
    const { gate: g, start } = gate();
    expect(g.running).toBe(false);
    g.setVisible(true);
    g.setVisible(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(g.running).toBe(true);
  });

  it("stops the loop when the canvas leaves the viewport and resumes when it returns", () => {
    const { gate: g, start, stop } = gate();
    g.setVisible(true);
    g.setVisible(false);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(g.running).toBe(false);
    g.setVisible(false);
    expect(stop).toHaveBeenCalledTimes(1);
    g.setVisible(true);
    expect(start).toHaveBeenCalledTimes(2);
  });

  it("never starts again after dispose", () => {
    const { gate: g, start, stop } = gate();
    g.setVisible(true);
    g.dispose();
    expect(stop).toHaveBeenCalledTimes(1);
    g.setVisible(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(g.running).toBe(false);
  });
});
