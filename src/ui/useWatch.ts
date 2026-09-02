import { useSyncExternalStore } from "react";

import type { Watch } from "./watch";

/** the watch's current value, re-rendering on every change while mounted */
export function useWatch<T>(watch: Watch<T>): T {
  return useSyncExternalStore(watch.subscribe, watch.getSnapshot, watch.getSnapshot);
}
