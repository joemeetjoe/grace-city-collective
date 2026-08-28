/**
 * Hands `SiteContent` to the tree. First paint is always the built-in
 * `site` — nothing waits on the network — and if `source` later resolves to
 * something different it is swapped in and the page re-renders with the
 * published words. Outside a provider `useSite()` is simply the built-in
 * content (see useSite.ts), so components and their tests need no wrapper.
 */

import { useEffect, useState, type ReactNode } from "react";

import { site, type SiteContent } from "./site";
import { SiteContext } from "./siteContext";

type Props = {
  /** where the published content comes from; omitted means built-in only */
  source?: () => Promise<SiteContent>;
  children: ReactNode;
};

export function SiteProvider({ source, children }: Props) {
  const [content, setContent] = useState<SiteContent>(site);

  useEffect(() => {
    if (!source) return;
    let live = true;
    const builtIn = JSON.stringify(site);
    source().then((loaded) => {
      if (live && JSON.stringify(loaded) !== builtIn) setContent(loaded);
    });
    return () => {
      live = false;
    };
  }, [source]);

  return <SiteContext value={content}>{children}</SiteContext>;
}
