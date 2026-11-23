// The landing page's motion, and only the landing page's (the owner, 2026-11-22 19:37 UTC: "Use lenis smooth
// scrolling, GSAP microanimations and page transitions", then "Everything should be fairly subtle actually"). The page
// transitions are the app's own sideways slide, which every screen now has (src/routes/+layout.svelte). The
// scroll glides a little, each block below the first screen rises a few pixels as it comes into view, the phones drift
// a touch slower than the page and the money bar fills in. A person who asked for less motion gets none of it: the
// page is the same, standing still.
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

/** True when the person asked their device for less motion. */
export function wantsLessMotion(): boolean {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Starts the scroll and the reveals inside `page`; the function it gives back stops them and puts everything back. */
export function startMotion(page: HTMLElement): () => void {
  if (wantsLessMotion()) return () => undefined;
  gsap.registerPlugin(ScrollTrigger);

  // A light glide on a wheel or a trackpad; a finger on a phone scrolls the way it always does.
  const lenis = new Lenis({ lerp: 0.14 });
  lenis.on("scroll", () => {
    ScrollTrigger.update();
  });
  const tick = (seconds: number): void => {
    lenis.raf(seconds * 1000);
  };
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  const context = gsap.context(() => {
    // Only a block still below the window is hidden to rise in: one already on screen never blinks out and back.
    const below = gsap.utils
      .toArray<HTMLElement>(".pair .card, .band")
      .filter((block) => block.getBoundingClientRect().top > window.innerHeight);
    for (const block of below) {
      gsap.from(block, {
        y: 24,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
        scrollTrigger: { trigger: block, start: "top 92%", once: true },
      });
    }
    // The phones move a little slower than the page, so the screenshots sit a step behind the words.
    for (const phone of gsap.utils.toArray<HTMLElement>(".device")) {
      gsap.fromTo(
        phone,
        { y: 24 },
        {
          y: -24,
          ease: "none",
          scrollTrigger: { trigger: phone, start: "top bottom", end: "bottom top", scrub: true },
        },
      );
    }
    // The money bar fills from the left, part by part, the first time it is seen.
    gsap.from(".splitbar span", {
      scaleX: 0,
      transformOrigin: "left center",
      duration: 0.6,
      ease: "power2.out",
      stagger: 0.12,
      scrollTrigger: { trigger: ".splitbar", start: "top 90%", once: true },
    });
  }, page);

  return () => {
    context.revert();
    gsap.ticker.remove(tick);
    lenis.destroy();
  };
}
