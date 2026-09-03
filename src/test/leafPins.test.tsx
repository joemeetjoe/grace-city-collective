import { render } from "@testing-library/react";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import CollectiveScript from "@/marks/CollectiveScript";
import GatheringMark from "@/marks/GatheringMark";
import GMark from "@/marks/GMark";
import Lockup from "@/marks/Lockup";
import Seal from "@/marks/Seal";
import SowingMark from "@/marks/SowingMark";
import CornerOrnaments from "@/ui/CornerOrnaments";
import OrnateRule from "@/ui/OrnateRule";
import Reveal from "@/ui/Reveal";

/**
 * The marks, the ornaments and Reveal render the very DOM they did before
 * #126 made them memoised leaves: each recipe below was rendered at the
 * untouched tip (shape-batch d8022f2) and its `container.innerHTML` hashed.
 * A pin moving means the markup moved — re-pin only with a shot gate that
 * proves the pixels did not.
 */
const PINS = {
  reveal: "5aa1a4b1e0a778d0f369bd05855dab729013dd8f59acef99b63b564c352b4afb",
  revealShown: "45ff4fa5bb14373dbfde7eb7a3d2311204a6a7435ff5685729895c2d44136d6a",
  gmark: "9f8dbf283f928dea794457f8c57471abc6488f31298acdb23ee09bc87efccdde",
  script: "cddd1aa2cd5fca5dcae913d50706d8f56cda8564a474164dffc6f4f9d0ba65dc",
  gathering: "e76c2fc032ad482f7288a26d94321c98be3f9f80c90842d146e3e4248f0e0262",
  sowing: "e0260eaf60fc606c547568fa16d9fdbfec8ec7b66b7d7bed33e21aba7c33f736",
  rule: "abc1c81e4d1eb7ec09d87a5a7b4a53e1ce4e99159ae61f4fa4c2d2b024b244db",
  corners: "4cb3cb98fc6bc24ce68a6d8538e56b66cbc2805bba7183d79ec390d7293bc76d",
  lockup: "31aa4e514d151f2ec0865ff4d3728a49a66e47dd5cffe6638c5a2598d93dbd1f",
  seal: "324d2c70b1a78d295294fe5a95a820bf805d88d4ba2eb36f2ec2e302f86194a7",
};

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** useId's part of the seal's paint-server ids, which depends on the tree around it */
const withoutIds = (html: string) => html.replace(/_r_[0-9a-z]+_/g, "_ID_");

const RECIPES: Record<keyof typeof PINS, () => string> = {
  reveal: () =>
    render(
      <Reveal as="ol" delay={200} stagger={90} className="grid rule-draw">
        <li>a</li>
        <li style={{ color: "red" }}>b</li>
        <li className="rule-draw">c</li>
        text
        {null}
        <li>d</li>
      </Reveal>,
    ).container.innerHTML,
  revealShown: () =>
    render(
      <Reveal shown={false}>
        <p>one</p>
        <p>two</p>
      </Reveal>,
    ).container.innerHTML,
  gmark: () =>
    render(
      <>
        <GMark />
        <GMark size={40} ruled />
        <GMark size="0.63em" decorative title="t" className="c" style={{ color: "red" }} />
      </>,
    ).container.innerHTML,
  script: () =>
    render(
      <>
        <CollectiveScript />
        <CollectiveScript className="x" style={{ height: "1em" }} title="T" />
      </>,
    ).container.innerHTML,
  gathering: () =>
    render(
      <>
        {(["homes", "feast", "one", "two", "table"] as const).map((m) => (
          <GatheringMark key={m} mark={m} />
        ))}
        <GatheringMark mark="homes" lit tour />
        <GatheringMark mark="feast" lit shown={false} delay={400} size={32} className="c" />
      </>,
    ).container.innerHTML,
  sowing: () =>
    render(
      <>
        <SowingMark />
        <SowingMark lit />
        <SowingMark shown={false} className="c" />
      </>,
    ).container.innerHTML,
  rule: () =>
    render(
      <>
        <OrnateRule />
        <OrnateRule ends="start" vertical drawn={false} delay={100} className="c" style={{ top: 1 }} />
        <OrnateRule ends="end" />
      </>,
    ).container.innerHTML,
  corners: () =>
    render(
      <>
        <CornerOrnaments />
        <CornerOrnaments shown={false} arm="10px" inset="2px" className="c" />
      </>,
    ).container.innerHTML,
  lockup: () =>
    withoutIds(
      render(
        <>
          <Lockup />
          <Lockup script size="20px" className="c" style={{ color: "red" }} />
        </>,
      ).container.innerHTML,
    ),
  seal: () => withoutIds(render(<Seal />).container.innerHTML),
};

describe("the leaves' DOM is pinned", () => {
  for (const key of Object.keys(PINS) as (keyof typeof PINS)[]) {
    it(`${key} renders the pinned markup`, () => {
      const html = RECIPES[key]();
      if (sha(html) !== PINS[key]) expect(html).toBe(`<the markup whose sha256 is ${PINS[key]}>`);
    });
  }
});
