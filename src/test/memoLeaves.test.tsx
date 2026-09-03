import { act, render } from "@testing-library/react";
import { useSyncExternalStore, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import CollectiveScript from "@/marks/CollectiveScript";
import GatheringMark from "@/marks/GatheringMark";
import GMark from "@/marks/GMark";
import Seal from "@/marks/Seal";
import SowingMark from "@/marks/SowingMark";
import CornerOrnaments from "@/ui/CornerOrnaments";
import OrnateRule from "@/ui/OrnateRule";
import { countRenders, type MemoLeaf } from "./countRenders";

/** a style object a parent holds on to, as a stable one is passed */
const STYLE = { top: 1 };

type Case = {
  name: string;
  leaf: MemoLeaf<never>;
  /** the leaf as a parent renders it — fresh elements, equal props */
  same: () => ReactNode;
  /** the leaf with one prop changed */
  changed: () => ReactNode;
};

const CASES: Case[] = [
  { name: "Seal", leaf: Seal, same: () => <Seal size={28} className="c" />, changed: () => <Seal size={30} className="c" /> },
  { name: "GMark", leaf: GMark, same: () => <GMark size={40} ruled />, changed: () => <GMark size={40} /> },
  {
    name: "CollectiveScript",
    leaf: CollectiveScript,
    same: () => <CollectiveScript className="x" />,
    changed: () => <CollectiveScript className="y" />,
  },
  {
    name: "GatheringMark",
    leaf: GatheringMark,
    same: () => <GatheringMark mark="homes" lit tour />,
    changed: () => <GatheringMark mark="homes" lit />,
  },
  { name: "SowingMark", leaf: SowingMark, same: () => <SowingMark lit />, changed: () => <SowingMark /> },
  {
    name: "OrnateRule",
    leaf: OrnateRule,
    same: () => <OrnateRule ends="start" vertical drawn={false} delay={100} style={STYLE} />,
    changed: () => <OrnateRule ends="start" vertical drawn delay={100} style={STYLE} />,
  },
  {
    name: "CornerOrnaments",
    leaf: CornerOrnaments,
    same: () => <CornerOrnaments shown={false} arm="10px" />,
    changed: () => <CornerOrnaments shown arm="10px" />,
  },
];

/** something outside React the parent watches, for the test to poke it with */
function createTick() {
  let n = 0;
  const subs = new Set<() => void>();
  return {
    subscribe: (cb: () => void) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    get: () => n,
    bump: () => {
      n += 1;
      subs.forEach((cb) => cb());
    },
  };
}

/** a parent with state of its own: a resize or a hover in it re-renders it, and it re-renders its leaf with equal props */
function Parent({ leaf, tick }: { leaf: () => ReactNode; tick: ReturnType<typeof createTick> }) {
  useSyncExternalStore(tick.subscribe, tick.get);
  return <>{leaf()}</>;
}

describe.each(CASES)("$name is a memoised leaf", ({ leaf, same, changed }) => {
  it("does not render again when its parent re-renders with equal props, and does when one changes", () => {
    const counter = countRenders(leaf);
    const tick = createTick();
    try {
      const { rerender } = render(<Parent leaf={same} tick={tick} />);
      expect(counter.renders()).toBe(1);
      act(() => tick.bump());
      act(() => tick.bump());
      expect(counter.renders()).toBe(1);
      rerender(<Parent leaf={changed} tick={tick} />);
      expect(counter.renders()).toBe(2);
    } finally {
      counter.restore();
    }
  });
});
