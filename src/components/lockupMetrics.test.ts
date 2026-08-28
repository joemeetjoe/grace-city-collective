import { describe, expect, it } from "vitest";

import { SCRIPT_EM, SCRIPT_MIN_PX, scriptHeightFor, showScript } from "./lockupMetrics";

describe("showScript", () => {
  it("renders the cursive line only when it would be at least 18px tall", () => {
    expect(SCRIPT_MIN_PX).toBe(18);
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
});
