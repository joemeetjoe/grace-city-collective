import { createContext } from "react";

import { site, type SiteContent } from "./site";

/** the words the tree renders; the built-in content is the default (and, for now, only) value */
export const SiteContext = createContext<SiteContent>(site);
