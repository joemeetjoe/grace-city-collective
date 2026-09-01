/**
 * The site's hover and focus manners, shared so every link and button
 * answers the pointer and the keyboard the same way. The two motion
 * utilities live in index.css.
 */

/** a hairline ring on keyboard focus only, stood off the element on ink, like the dot rail's */
export const FOCUS_RING =
  "outline-none focus-visible:ring-1 focus-visible:ring-cream/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

/** a text link: a hairline underline sweeps in from the left on hover */
export const LINK_SWEEP = "link-sweep";

/** a button: it lifts a pixel and casts a soft glow of its own colour on hover, and settles on press */
export const BUTTON_LIFT = "btn-lift";
