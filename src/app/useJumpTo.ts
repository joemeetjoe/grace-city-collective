import { useContext } from "react";

import type { JumpTo } from "./jump";
import { JumpContext } from "./jumpContext";

/** the jump the app provided (JumpProvider.tsx); stable for as long as the provider's is */
export function useJumpTo(): JumpTo {
  return useContext(JumpContext);
}
