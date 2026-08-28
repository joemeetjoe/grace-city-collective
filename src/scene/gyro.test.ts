import { afterEach, describe, expect, it, vi } from "vitest";

import { armGyroOnFirstTouch, requestGyro } from "./gyro";

type DOE = { requestPermission?: () => Promise<"granted" | "denied"> };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("requestGyro", () => {
  it("asks iOS for permission and reports the answer", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    await expect(requestGyro({ requestPermission } as DOE)).resolves.toBe("granted");
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("reports a refusal", async () => {
    await expect(requestGyro({ requestPermission: async () => "denied" } as DOE)).resolves.toBe("denied");
  });

  it("is a no-op where the prompt does not exist (Android, desktop)", async () => {
    await expect(requestGyro({} as DOE)).resolves.toBe("unsupported");
    await expect(requestGyro(undefined)).resolves.toBe("unsupported");
  });

  it("reads a rejected prompt as denied rather than throwing", async () => {
    await expect(requestGyro({ requestPermission: () => Promise.reject(new Error("no gesture")) } as DOE)).resolves.toBe(
      "denied",
    );
  });
});

describe("armGyroOnFirstTouch", () => {
  it("requests once on the first pointerdown and then stops listening", () => {
    const target = new EventTarget();
    const request = vi.fn().mockResolvedValue("granted");
    armGyroOnFirstTouch(target, request);
    expect(request).not.toHaveBeenCalled();
    target.dispatchEvent(new Event("pointerdown"));
    target.dispatchEvent(new Event("pointerdown"));
    target.dispatchEvent(new Event("touchend"));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("a touch end counts as the first touch too", () => {
    const target = new EventTarget();
    const request = vi.fn().mockResolvedValue("granted");
    armGyroOnFirstTouch(target, request);
    target.dispatchEvent(new Event("touchend"));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("the teardown disarms it before any touch", () => {
    const target = new EventTarget();
    const request = vi.fn().mockResolvedValue("granted");
    const disarm = armGyroOnFirstTouch(target, request);
    disarm();
    target.dispatchEvent(new Event("pointerdown"));
    expect(request).not.toHaveBeenCalled();
  });
});
