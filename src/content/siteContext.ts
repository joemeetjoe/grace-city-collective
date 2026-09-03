import { createContext } from "react";

import { site, type SiteContent } from "./site";

/**
 * The words the tree renders. The built-in content is the default value, so
 * a component (or a test) renders without a provider; `SiteProvider` at the
 * root (main.tsx) is where other content would come in. This is the one
 * module that imports the content object itself: everything else reads it
 * through `useSite`.
 */
export const SiteContext = createContext<SiteContent>(site);
