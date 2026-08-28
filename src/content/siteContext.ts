import { createContext } from "react";

import { site, type SiteContent } from "./site";

/** the words the tree renders; the built-in content wherever no provider sits above */
export const SiteContext = createContext<SiteContent>(site);
