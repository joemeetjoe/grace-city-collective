import { createContext, type ReactNode } from "react";

import { jumpTo as scrollJumpTo } from "@/scroll/jump";
import type { JumpTo } from "./jump";

/**
 * How the nav gets the page's jump. The jump needs the page's scroll — the
 * smoother's driver while one runs — which only the app holds
 * (useSmoothScroll), and the store holds facts, never functions; so the app
 * provides the jump it built (jump.ts) and the links read it through
 * useJumpTo, by way of features/nav/useNavigate.ts. The default value is a
 * working jump, so a link renders without a provider (a test): native
 * scroll to the section, the long-form chunk left to the in-view request.
 */
// the context and its provider share the default's one definition, so they
// live together (react-refresh would rather the component stood alone)
// eslint-disable-next-line react-refresh/only-export-components
export const JumpContext = createContext<JumpTo>((id) => scrollJumpTo(id, null));

export function JumpProvider({ jump, children }: { jump: JumpTo; children: ReactNode }) {
  return <JumpContext.Provider value={jump}>{children}</JumpContext.Provider>;
}
