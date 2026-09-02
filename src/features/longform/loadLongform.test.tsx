import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { site } from "@/content/site";
import Longform from "./Longform";
import { loadLongform } from "./loadLongform";

describe("loadLongform", () => {
  it("resolves to the long-form component: one part per section, and the footer", async () => {
    const mod = await loadLongform();
    expect(mod.default).toBe(Longform);
  });
});

describe("Longform", () => {
  it("renders a section's words by its id, without the section shell (the gate owns that)", () => {
    for (const s of site.longform) {
      const { container, unmount } = render(<Longform part={s.id} />);
      expect(container.querySelector("section")).toBeNull();
      expect(container.querySelector("h2")?.textContent).toContain(s.heading);
      expect(container.querySelector('[data-ornate-rule="both"]')).not.toBeNull();
      unmount();
    }
  });

  it("renders the footer as its last part", () => {
    const { container } = render(<Longform part="footer" />);
    expect(container.querySelector("footer")).not.toBeNull();
    expect(container.textContent).toContain(site.name);
  });
});
