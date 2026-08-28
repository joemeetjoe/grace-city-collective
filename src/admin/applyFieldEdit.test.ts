import { describe, expect, it } from "vitest";

import { applyFieldEdit, pathLabel } from "./applyFieldEdit";
import { site } from "@/content/site";

describe("applyFieldEdit", () => {
  it("sets a nested value without touching the original", () => {
    const next = applyFieldEdit(site, ["scene", 2, "heading"], "New heading");
    expect(next.scene[2].heading).toBe("New heading");
    expect(site.scene[2].heading).toBe("Small rooms, long tables, real names.");
    expect(next).not.toBe(site);
  });

  it("copies only the spine of the path; siblings keep their identity", () => {
    const next = applyFieldEdit(site, ["contact", "address", "city"], "Elsewhere, GA");
    expect(next.contact.address.city).toBe("Elsewhere, GA");
    expect(next.contact).not.toBe(site.contact);
    expect(next.contact.pastor).toBe(site.contact.pastor);
    expect(next.scene).toBe(site.scene);
  });

  it("replaces a whole array, which is how add and remove are expressed", () => {
    const next = applyFieldEdit(site, ["faq"], site.faq.slice(1));
    expect(next.faq).toHaveLength(site.faq.length - 1);
    expect(next.faq[0]).toBe(site.faq[1]);
  });

  it("sets an element inside an array of strings", () => {
    const next = applyFieldEdit(site, ["scene", 1, "body", 0], "First paragraph.");
    expect(next.scene[1].body[0]).toBe("First paragraph.");
    expect(next.scene[1].body[1]).toBe(site.scene[1].body[1]);
    expect(Array.isArray(next.scene[1].body)).toBe(true);
  });

  it("removes a key when the value is undefined, for optional fields", () => {
    const next = applyFieldEdit(site, ["scene", 0, "kicker"], undefined);
    expect("kicker" in next.scene[0]).toBe(false);
  });

  it("labels a path the way the validator does", () => {
    expect(pathLabel(["scene", 2, "heading"])).toBe("scene[2].heading");
    expect(pathLabel(["contact", "address", "city"])).toBe("contact.address.city");
  });
});
