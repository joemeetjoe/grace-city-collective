import { describe, expect, it } from "vitest";

import { TIERS, TIER_LOW_DPR, TIER_NARROW_WIDTH, readTierInputs, tierFor, tierWidth } from "./tier";

describe("tierFor", () => {
  it("a wide, sharp, unmetered viewport gets the desktop tier", () => {
    const tier = tierFor({ width: 1600, dpr: 2, saveData: false });
    expect(tier).toBe(TIERS.desktop);
  });

  it("a narrow viewport gets the mobile tier whatever its DPR", () => {
    expect(tierFor({ width: 393, dpr: 3, saveData: false })).toBe(TIERS.mobile);
    expect(tierFor({ width: 820, dpr: 2, saveData: false })).toBe(TIERS.mobile);
    expect(tierFor({ width: TIER_NARROW_WIDTH - 1, dpr: 2, saveData: false })).toBe(TIERS.mobile);
    expect(tierFor({ width: TIER_NARROW_WIDTH, dpr: 2, saveData: false })).toBe(TIERS.desktop);
  });

  it("a low-DPR viewport gets the mobile tier however wide", () => {
    expect(tierFor({ width: 1920, dpr: 1, saveData: false })).toBe(TIERS.mobile);
    expect(tierFor({ width: 1920, dpr: TIER_LOW_DPR, saveData: false })).toBe(TIERS.desktop);
  });

  it("Save-Data forces the mobile tier", () => {
    expect(tierFor({ width: 1920, dpr: 2, saveData: true })).toBe(TIERS.mobile);
  });

});

describe("tierWidth", () => {
  it("resolves each tier to its own texture set", () => {
    expect(tierWidth(TIERS.desktop)).toBe(2048);
    expect(tierWidth(TIERS.mobile)).toBe(1024);
  });
});

describe("readTierInputs", () => {
  it("reads the viewport, DPR and Save-Data from the browser", () => {
    const win = { innerWidth: 412, devicePixelRatio: 2.6 } as Window;
    const nav = { connection: { saveData: true } } as unknown as Navigator;
    expect(readTierInputs(win, nav)).toEqual({ width: 412, dpr: 2.6, saveData: true });
  });

  it("treats a missing Network Information API as Save-Data off", () => {
    const win = { innerWidth: 1600, devicePixelRatio: 1 } as Window;
    expect(readTierInputs(win, {} as Navigator)).toEqual({ width: 1600, dpr: 1, saveData: false });
  });
});
