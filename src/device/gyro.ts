/**
 * iOS gates `deviceorientation` behind a permission prompt that may only be
 * raised from a user gesture. Everywhere else the events just flow, so the
 * request is a no-op.
 */

export type GyroPermission = "granted" | "denied" | "unsupported";

type OrientationEventCtor = { requestPermission?: () => Promise<"granted" | "denied"> };

/** a `requestPermission` function on the constructor is iOS's prompt */
const hasPrompt = (x: unknown): x is Required<OrientationEventCtor> =>
  typeof x === "function" && "requestPermission" in x && typeof x.requestPermission === "function";

/** `DeviceOrientationEvent` where the host has it with the prompt; undefined elsewhere (Android, desktop, jsdom) */
function orientationCtor(): OrientationEventCtor | undefined {
  if (!("DeviceOrientationEvent" in globalThis)) return undefined;
  const ctor: unknown = globalThis.DeviceOrientationEvent;
  return hasPrompt(ctor) ? ctor : undefined;
}

/** call `DeviceOrientationEvent.requestPermission` where it exists; a throw reads as denied */
export async function requestGyro(ctor: OrientationEventCtor | undefined = orientationCtor()): Promise<GyroPermission> {
  if (typeof ctor?.requestPermission !== "function") return "unsupported";
  try {
    return await ctor.requestPermission();
  } catch {
    return "denied";
  }
}

/** the first of these is the gesture the prompt rides on */
const GYRO_GESTURES = ["pointerdown", "touchend"] as const;

/**
 * Raise the prompt once, on the first touch. Returns the teardown; the first
 * gesture (or the teardown) removes every listener.
 */
export function armGyroOnFirstTouch(
  target: EventTarget = window,
  request: () => Promise<GyroPermission> = requestGyro,
): () => void {
  const stop = () => {
    for (const type of GYRO_GESTURES) target.removeEventListener(type, fire);
  };
  const fire = () => {
    stop();
    void request();
  };
  for (const type of GYRO_GESTURES) target.addEventListener(type, fire, { passive: true });
  return stop;
}
