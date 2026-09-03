import type { ReactNode } from "react";

import type { JumpTo } from "./jump";
import { JumpContext } from "./jumpContext";

/** the app's jump (useJump), provided to the nav's links (useJumpTo) */
export function JumpProvider({ jump, children }: { jump: JumpTo; children: ReactNode }) {
  return <JumpContext.Provider value={jump}>{children}</JumpContext.Provider>;
}
