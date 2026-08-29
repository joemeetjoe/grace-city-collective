import { lozengePath } from "@/components/lozenge";

/** the small outer lozenge of an OrnateRule finial, in px */
const W = 10;
const H = 5;

function Divider() {
  return (
    <svg
      aria-hidden
      data-ref-lozenge=""
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="mx-2 inline-block shrink-0 align-middle text-cream"
    >
      <path d={lozengePath(W / 2, H / 2, W, H)} fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** the separate passages of a refs string, as written in the content: one per `;` */
export function splitRefs(refs: string): string[] {
  return refs
    .split(";")
    .map((r) => r.trim())
    .filter(Boolean);
}

/**
 * A run of scripture references with a hollow cream lozenge — the small one
 * from an OrnateRule finial — between each passage, so where a belief cites
 * several they read apart. Commas within a passage (verses of one book) are
 * left as they are.
 */
export default function ScriptureRefs({ refs }: { refs: string }) {
  const parts = splitRefs(refs);
  return (
    <>
      {parts.map((ref, i) => (
        <span key={`${i}-${ref}`} className="inline-block">
          {i > 0 && <Divider />}
          {ref}
        </span>
      ))}
    </>
  );
}
