/**
 * Immutable nested set for the editor's form state. `path` is the route
 * into the document (`["scene", 2, "heading"]`); every object or array on
 * that route is copied, everything beside it keeps its identity, so a
 * keystroke costs one shallow copy per level. Arrays are replaced whole by
 * addressing them directly, which is how add/remove are expressed.
 */

import type { SiteContent } from "@/content/site";

export type Path = readonly (string | number)[];

function setIn(node: unknown, path: Path, value: unknown): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  if (Array.isArray(node)) {
    const copy = node.slice();
    copy[head as number] = setIn(node[head as number], rest, value);
    return copy;
  }
  const record = (node ?? {}) as Record<string, unknown>;
  const copy: Record<string, unknown> = { ...record };
  if (rest.length === 0 && value === undefined) delete copy[head as string];
  else copy[head as string] = setIn(record[head as string], rest, value);
  return copy;
}

export function applyFieldEdit(content: SiteContent, path: Path, value: unknown): SiteContent {
  return setIn(content, path, value) as SiteContent;
}

/** `["scene", 2, "heading"]` → `scene[2].heading`, matching the validator's error paths */
export function pathLabel(path: Path): string {
  return path.reduce<string>((acc, part) => (typeof part === "number" ? `${acc}[${part}]` : acc ? `${acc}.${part}` : part), "");
}
