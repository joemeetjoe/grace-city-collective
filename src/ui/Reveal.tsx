import {
  Children,
  cloneElement,
  isValidElement,
  useRef,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";

import { useInViewOnce } from "./useInViewOnce";

/** the wait between one child and the next, in ms; the rise itself (1100ms,
    18px), the hairline's draw (900ms) and its lead over the words (200ms) live
    in the [data-reveal] rules of src/index.css */
export const REVEAL_STAGGER_MS = 110;
/** how much of the block must be on screen before it comes in */
export const REVEAL_THRESHOLD = 0.2;

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
 * A block whose children rise into place one after another — faded and set
 * down a little until the block scrolls into view, then up and in, each a
 * beat after the last. Children marked `rule-draw` have their top hairline
 * drawn left to right just ahead of their words; so does the block itself
 * when it is the `rule-draw` item, as each entry of a long list is. Watched
 * once: the block comes in the first time it is seen and rests there, unless
 * `shown` drives it — and never waits past about half a screen of itself,
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
  const ref = useRef<HTMLElement>(null);
  const seen = useInViewOnce(ref, threshold, shown === undefined);
  const on = shown ?? seen;
  // one element type stands in for the union: every tag here takes the same props
  const Tag = as as "div";
  return (
    <Tag
      {...rest}
      ref={ref as React.Ref<HTMLDivElement>}
      data-reveal={on ? "true" : "false"}
      style={
        {
          "--reveal-delay": `${delay}ms`,
          "--reveal-stagger": `${stagger}ms`,
          ...style,
        } as CSSProperties
      }
    >
      {indexed(children)}
    </Tag>
  );
}

/** each child numbered for its place in the stagger, as a custom property the CSS reads */
function indexed(children: ReactNode): ReactNode[] {
  return Children.toArray(children).map((child, i) =>
    isValidElement<{ style?: CSSProperties }>(child)
      ? cloneElement(child, {
          style: { ...child.props.style, "--i": i } as CSSProperties,
        })
      : child,
  );
}
