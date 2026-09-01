import { createContext } from "react";

/** whether the reader prefers reduced motion: the stops' ornaments then rest, shown */
export const ReducedMotionContext = createContext(false);

/** whether the splash is still up, for the hero's pieces that wait for the handoff */
export const IntroPendingContext = createContext(false);
