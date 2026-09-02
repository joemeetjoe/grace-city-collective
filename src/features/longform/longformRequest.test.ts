import { describe, expect, it, vi } from "vitest";

/** a fresh store per test: the module holds the page's one request */
async function fresh() {
  vi.resetModules();
  return import("./longformRequest");
}

describe("the long-form gate store", () => {
  it("starts unrequested and unmounted", async () => {
    const gate = await fresh();
    expect(gate.isLongformRequested()).toBe(false);
    expect(gate.isLongformMounted()).toBe(false);
  });

  it("tells its subscribers of the first request and of the mount, once each", async () => {
    const gate = await fresh();
    const heard = vi.fn();
    const off = gate.subscribeLongform(heard);
    gate.requestLongform();
    gate.requestLongform();
    expect(heard).toHaveBeenCalledTimes(1);
    expect(gate.isLongformRequested()).toBe(true);
    gate.markLongformMounted();
    gate.markLongformMounted();
    expect(heard).toHaveBeenCalledTimes(2);
    off();
    const late = vi.fn();
    gate.subscribeLongform(late);
    gate.requestLongform();
    gate.markLongformMounted();
    expect(late).not.toHaveBeenCalled();
  });

  it("a request resolves once the chunk has mounted, however many asked", async () => {
    const gate = await fresh();
    let landed = 0;
    const a = gate.requestLongform().then(() => (landed += 1));
    const b = gate.requestLongform().then(() => (landed += 1));
    await new Promise((r) => setTimeout(r, 5));
    expect(landed).toBe(0);
    gate.markLongformMounted();
    await Promise.all([a, b]);
    expect(landed).toBe(2);
    expect(gate.isLongformMounted()).toBe(true);
    // asking after the mount resolves at once
    await gate.requestLongform();
  });

  it("watches two viewports below the fold, and nothing above", async () => {
    const { LONGFORM_MARGIN } = await fresh();
    expect(LONGFORM_MARGIN).toBe("0px 0px 200% 0px");
  });
});
