import { createContext, type ReactNode } from "react";

import { site, type SiteContent } from "./site";

/**
 * The words the tree renders. The built-in content is the default value, so
 * a component (or a test) renders without a provider; `SiteProvider` at the
 * root (main.tsx) is where other content would come in. This is the one
 * module that imports the content object itself: everything else reads it
 * through `useSite`.
 */
// the context and its provider share the one import of the content object,
// so they live together (react-refresh would rather the component stood alone)
// eslint-disable-next-line react-refresh/only-export-components
export const SiteContext = createContext<SiteContent>(site);

export function SiteProvider({ content = site, children }: { content?: SiteContent; children: ReactNode }) {
  return <SiteContext.Provider value={content}>{children}</SiteContext.Provider>;
}
