import { createContext } from "react";

import { jumpTo, type JumpTo } from "./jump";

/**
 * How the nav gets the page's jump. The jump needs the page's scroll — the
 * smoother's driver while one runs — which only the app holds
 * (useSmoothScroll), and the store holds facts, never functions; so the app
 * provides the jump it built (jump.ts) through JumpProvider, and the links
 * read it through useJumpTo, by way of features/nav/useNavigate.ts. The
 * default value is a working jump, so a link renders without a provider (a
 * test): native scroll to the section, the long-form chunk left to the
 * in-view request.
 */
export const JumpContext = createContext<JumpTo>((id, options) => jumpTo(id, null, options));
