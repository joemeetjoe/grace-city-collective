import { describe, expect, it } from "vitest";

import { introGateOpen } from "./gate";

describe("introGateOpen", () => {
  it("stays closed while textures are loading and the intro is still running", () => {
    expect(introGateOpen({ loaded: false, minimumElapsed: false, skipped: false })).toBe(false);
  });

  it("waits for the full intro run even when textures loaded early", () => {
    expect(introGateOpen({ loaded: true, minimumElapsed: false, skipped: false })).toBe(false);
  });

  it("waits on ink for textures that arrive after the intro finished", () => {
    expect(introGateOpen({ loaded: false, minimumElapsed: true, skipped: false })).toBe(false);
  });

  it("opens once textures are in and one intro run has elapsed", () => {
    expect(introGateOpen({ loaded: true, minimumElapsed: true, skipped: false })).toBe(true);
  });

  it("a skip before load still waits for textures", () => {
    expect(introGateOpen({ loaded: false, minimumElapsed: false, skipped: true })).toBe(false);
  });

  it("a skip after load opens immediately, without waiting out the intro", () => {
    expect(introGateOpen({ loaded: true, minimumElapsed: false, skipped: true })).toBe(true);
  });

  it("a skip while waiting on ink after the intro finished still waits for textures", () => {
    expect(introGateOpen({ loaded: false, minimumElapsed: true, skipped: true })).toBe(false);
  });

  it("a skip changes nothing once the gate is already open", () => {
    expect(introGateOpen({ loaded: true, minimumElapsed: true, skipped: true })).toBe(true);
  });

  it("flipping skipped is the only way to open the gate early once textures are in", () => {
    const before = { loaded: true, minimumElapsed: false, skipped: false };
    expect(introGateOpen(before)).toBe(false);
    expect(introGateOpen({ ...before, skipped: true })).toBe(true);
  });
});
