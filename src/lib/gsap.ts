import { gsap } from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { Flip } from "gsap/Flip";
import { MorphSVGPlugin } from "gsap/MorphSVGPlugin";
import { Observer } from "gsap/Observer";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// Registered once, here. Import gsap from this module everywhere so the
// plugins are always available and never registered twice.
gsap.registerPlugin(DrawSVGPlugin, Flip, MorphSVGPlugin, Observer, ScrollTrigger, ScrollSmoother, SplitText);

export { gsap, DrawSVGPlugin, Flip, MorphSVGPlugin, Observer, ScrollSmoother, ScrollTrigger, SplitText };
