import type { ComponentType, ReactNode } from "react";

/** what React.memo returns, as far as the counter needs it: the leaf's own function under `type` */
export type MemoLeaf<P> = { readonly type: ComponentType<P> };

/**
 * A render counter for a memoised leaf, test-only: a wrapper is put in the
 * memo's place around the leaf's own function, so `renders()` says how often
 * its body ran. React.memo bails out before the body when the props are
 * shallow-equal, so a parent re-rendering with equal props must leave the
 * count where it was. Install before the first render; `restore()` puts the
 * leaf back for the next test.
 */
export function countRenders<P>(leaf: MemoLeaf<P>): { renders: () => number; restore: () => void } {
  const memo = leaf as unknown as { type: (props: P) => ReactNode };
  const inner = memo.type;
  let n = 0;
  memo.type = function Counted(props: P): ReactNode {
    n += 1;
    return inner(props);
  };
  return {
    renders: () => n,
    restore: () => {
      memo.type = inner;
    },
  };
}
