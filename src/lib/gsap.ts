import { gsap } from "gsap";
import { Observer } from "gsap/Observer";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// Registered once, here. Import gsap from this module everywhere so the
// plugins are always available and never registered twice.
gsap.registerPlugin(Observer, ScrollTrigger, ScrollSmoother, SplitText);

export { gsap, Observer, ScrollSmoother, ScrollTrigger, SplitText };
