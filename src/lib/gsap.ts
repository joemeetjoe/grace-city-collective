import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Observer } from "gsap/Observer";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// Registered once, here. Import gsap from this module everywhere so the
// plugins are always available and never registered twice.
gsap.registerPlugin(DrawSVGPlugin, Observer, ScrollTrigger, ScrollSmoother, SplitText);

export { gsap, DrawSVGPlugin, Observer, ScrollSmoother, ScrollTrigger, SplitText };
