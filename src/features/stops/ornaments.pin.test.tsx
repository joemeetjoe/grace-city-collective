import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { site, wayInWords } from "@/content/site";
import GatheringCalendar from "./GatheringCalendar";
import HouseTable from "./HouseTable";
import SharedLife from "./SharedLife";
import { useWayStep } from "./useWayStep";
import WayIn, { type WayInProps } from "./WayIn";

/**
 * The ornaments' DOM, pinned (#125): each of the four drawings in every
 * state its stop can put it in, serialised to a file under
 * __snapshots__/ornaments. The tile refactor must leave every one of them
 * identical apart from the two things it set out to change: every `data-*`
 * attribute is dropped before the comparison, and so is every state class
 * (`is-*`), so the fixtures cut at the untouched tip still read true.
 * Class order within an attribute is normalised (sorted) as Scene.dom does.
 */

const STEPS = [
  { id: "hello", title: "Say hello.", body: "Write to us." },
  { id: "reply", title: "A pastor writes back.", body: "A real person." },
  { id: "dinner", title: "Dinner.", body: "A meal with you and yours." },
  { id: "first-sunday", title: "First Sunday, all together.", body: "The five rooms become one." },
  { id: "rounds", title: "Make the rounds.", body: "A Sunday in each home." },
];

function Way({ initial = 0, ...rest }: { initial?: number } & Omit<WayInProps, "step" | "dir" | "onStep" | "words">) {
  const [way, onStep] = useWayStep(initial);
  return <WayIn step={way.step} dir={way.dir} onStep={onStep} words={wayInWords(site)} {...rest} />;
}

function pinOrnament(container: HTMLElement): string {
  const clone = container.cloneNode(true) as HTMLElement;
  for (const el of clone.querySelectorAll("*")) {
    for (const name of Array.from(el.getAttributeNames())) {
      if (name.startsWith("data-")) el.removeAttribute(name);
    }
    const cls = el.getAttribute("class");
    if (cls !== null) {
      const kept = cls
        .split(/\s+/)
        .filter((c) => c && !c.startsWith("is-"))
        .sort();
      if (kept.length) el.setAttribute("class", kept.join(" "));
      else el.removeAttribute("class");
    }
  }
  return `${clone.innerHTML.replace(/></g, ">\n<")}\n`;
}

const file = (name: string) => `./__snapshots__/ornaments/${name}.html`;

describe("the ornaments' DOM", () => {
  const cases: Array<[string, () => HTMLElement]> = [
    ["house-table.rest", () => render(<HouseTable />).container],
    ["house-table.lit", () => render(<HouseTable lit />).container],
    ["house-table.waiting", () => render(<HouseTable shown={false} />).container],
    ["house-table.across", () => render(<HouseTable across className="block w-full" />).container],
    ["house-table.across.lit", () => render(<HouseTable across lit />).container],
    ["shared-life.rest", () => render(<SharedLife />).container],
    ["shared-life.lit", () => render(<SharedLife lit />).container],
    ["shared-life.waiting", () => render(<SharedLife shown={false} />).container],
    ["shared-life.columns", () => render(<SharedLife columns={2} className="hidden md:block" />).container],
    ["shared-life.columns.lit", () => render(<SharedLife columns={2} lit />).container],
    ["calendar.rest", () => render(<GatheringCalendar />).container],
    ["calendar.feast", () => render(<GatheringCalendar lit="feast" />).container],
    ["calendar.homes", () => render(<GatheringCalendar lit="homes" />).container],
    ["calendar.waiting", () => render(<GatheringCalendar shown={false} />).container],
    ["calendar.across", () => render(<GatheringCalendar across className="w-full" />).container],
    ["calendar.across.homes.waiting", () => render(<GatheringCalendar across lit="homes" shown={false} />).container],
    ["way-in.rest", () => render(<Way steps={STEPS} className="pt-1" />).container],
    ["way-in.walked", () => render(<Way steps={STEPS} initial={2} />).container],
    ["way-in.last", () => render(<Way steps={STEPS} initial={4} />).container],
    ["way-in.waiting", () => render(<Way steps={STEPS} shown={false} />).container],
    ["way-in.single", () => render(<Way steps={STEPS} single initial={2} />).container],
    [
      "way-in.single.next",
      () => {
        const { container, getByRole } = render(<Way steps={STEPS} single />);
        fireEvent.click(getByRole("button", { name: "Next step" }));
        return container;
      },
    ],
    [
      "way-in.single.back",
      () => {
        const { container, getByRole } = render(<Way steps={STEPS} single initial={3} />);
        fireEvent.click(getByRole("button", { name: "Back a step" }));
        return container;
      },
    ],
  ];
  for (const [name, mount] of cases) {
    it(name, async () => {
      await expect(pinOrnament(mount())).toMatchFileSnapshot(file(name));
    });
  }
});
