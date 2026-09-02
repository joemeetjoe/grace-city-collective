import { useCallback, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

import { cssVars } from "@/theme/cssVars";
import { REVEAL_STAGGER_MS } from "@/theme/motion";
import { useInViewOnce } from "./useInViewOnce";

/** how much of the block must be on screen before it comes in */
const REVEAL_THRESHOLD = 0.2;

export type RevealTag = "div" | "header" | "footer" | "ol" | "ul" | "dl" | "li" | "p";

export type RevealProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  as?: RevealTag;
  /**
   * drive the state instead of watching the viewport: a scene panel's words
   * come in with its brackets and go back out with them
   */
  shown?: boolean;
  /** ms before the first child moves */
  delay?: number;
  /** ms between one child and the next */
  stagger?: number;
  /** how much of the block must be on screen before it comes in */
  threshold?: number;
  children: ReactNode;
};

/**
 * Number the block's children for the stagger: each direct child's place,
 * as the custom property the CSS reads (`--i`, index.css). Written on the
 * element after each commit rather than cloned into the children's props,
 * so the children keep their identity — a memoised child is not rendered
 * again when the block is — and a child's own style is left as it is. Every
 * node takes a place, as every child did before; a text node has no style
 * to wear its place on.
 */
function number(block: HTMLElement): void {
  let i = 0;
  for (const child of block.childNodes) {
    const at = String(i++);
    if (!(child instanceof Element)) continue;
    const { style } = child as HTMLElement | SVGElement;
    if (style.getPropertyValue("--i") !== at) style.setProperty("--i", at);
  }
}

/**
 * A block whose children rise into place one after another — faded and set
 * down a little until the block scrolls into view, then up and in, each a
 * beat after the last. Children marked `rule-draw` have their top hairline
 * drawn left to right just ahead of their words; so does the block itself
 * when it is the `rule-draw` item, as each entry of a long list is. Watched
 * once: the block comes in the first time it is seen and rests there, unless
 * `shown` drives it (then nothing is watched: no observer is ever made) —
 * and never waits past about half a screen of itself,
 * however tall (useInViewOnce caps `threshold` by the viewport), so a list
 * is best revealed per item, each entry its own Reveal, rather than whole.
 * The motion itself is CSS (index.css, on `[data-reveal]`), only where
 * motion is welcome: under reduced motion nothing is ever hidden. A direct
 * child's own transition utilities take precedence, so a child that needs
 * one (a link's underline) should be wrapped, not placed directly.
 */
export default function Reveal({
  as = "div",
  shown,
  delay = 0,
  stagger = REVEAL_STAGGER_MS,
  threshold = REVEAL_THRESHOLD,
  style,
  children,
  ...rest
}: RevealProps) {
  const [watch, seen] = useInViewOnce<HTMLElement>(threshold, shown === undefined);
  const on = shown ?? seen;
  const block = useRef<HTMLElement | null>(null);
  const attach = useCallback(
    (el: HTMLElement | null) => {
      block.current = el;
      watch(el);
    },
    [watch],
  );
  // the children may have changed with any render of the block: number them again before the paint
  useLayoutEffect(() => {
    if (block.current) number(block.current);
  });
  // one element type stands in for the union: every tag here takes the same props
  const Tag = as as "div";
  return (
    <Tag
      {...rest}
      ref={attach}
      data-reveal={on ? "true" : "false"}
      style={cssVars({
        "--reveal-delay": `${delay}ms`,
        "--reveal-stagger": `${stagger}ms`,
        ...style,
      })}
    >
      {children}
    </Tag>
  );
}
