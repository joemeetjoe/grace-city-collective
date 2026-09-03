/** the separate passages of a refs string, as written in the content: one per `;` */
export function splitRefs(refs: string): string[] {
  return refs
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean);
}
