import { describe, expect, it } from "vitest";

import {
  SCRIPT_EM,
  STACKED_SCRIPT_EM,
  scriptHeightFor,
  sealPeriodShiftEm,
  showScript,
} from "./lockupMetrics";

describe("showScript", () => {
  it("renders the cursive line only when it would be at least 18px tall", () => {
    expect(showScript(18)).toBe(true);
    expect(showScript(40)).toBe(true);
    expect(showScript(17.9)).toBe(false);
  });

  it("treats an unmeasured layout as too small (phones first)", () => {
    expect(showScript(0)).toBe(false);
    expect(showScript(Number.NaN)).toBe(false);
  });
});

describe("scriptHeightFor", () => {
  it("derives the script height from the wordmark's font size", () => {
    expect(scriptHeightFor(100)).toBeCloseTo(100 * SCRIPT_EM, 9);
    // the hero clamp bottoms out at 30px on phones → script is dropped there
    expect(showScript(scriptHeightFor(30))).toBe(false);
    // and is present at the desktop end of the clamp
    expect(showScript(scriptHeightFor(108))).toBe(true);
  });

  it("takes the stacked share below lg, which reads at the stacked clamp's floor (34px)", () => {
    expect(scriptHeightFor(34, STACKED_SCRIPT_EM)).toBeCloseTo(34 * STACKED_SCRIPT_EM, 9);
    expect(showScript(scriptHeightFor(34, STACKED_SCRIPT_EM))).toBe(true);
  });
});

describe("sealPeriodShiftEm", () => {
  it("centres the seal on the tail's lift-off height", () => {
    // a tail well above the baseline lifts the seal
    expect(sealPeriodShiftEm({ y: 100 }, { height: 216 })).toBeLessThan(sealPeriodShiftEm({ y: 204 }, { height: 216 }));
  });

  it("takes the stacked shares below lg, and the one-line ones by default", () => {
    expect(sealPeriodShiftEm({ y: 204 }, { height: 216 }, {})).toBe(sealPeriodShiftEm({ y: 204 }, { height: 216 }));
  });
});
