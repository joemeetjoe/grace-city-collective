import { gsap } from "gsap";

// The core only. Each plugin is registered by the modules that use it
// (idempotently — gsap ignores a second registration): ScrollTrigger and
// ScrollSmoother in scroll/smoother.ts, ScrollTrigger in scroll/sectionWatch.ts
// and scroll/refresh.ts, Observer and ScrollTrigger in scroll/attachPager.ts,
// SplitText in features/intro/heroRise.ts. Importing this module registers
// nothing, so a chunk that never scrolls never pays for the scroll plugins.
export { gsap };
