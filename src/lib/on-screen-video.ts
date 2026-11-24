// A video that plays only while a person can see it. A page with many clips (the landing page's wall and bands) would
// otherwise play and fetch every one at once, on screen or not. It keeps quiet-video.ts's rules: nothing plays by
// itself for a person who asked for less motion, is saving data or is on a small device.
import { loopByHand, mayMove } from "./quiet-video.ts";

/** What a clip does when it comes on or goes off the screen. */
export type ClipStep = "play" | "pause" | "still";

/** On screen it plays, off screen it pauses; where nothing may move by itself it stays still on its first frame. */
export function clipStep(onScreen: boolean, mayPlay: boolean): ClipStep {
  if (!mayPlay) return "still";
  return onScreen ? "play" : "pause";
}

/** A Svelte action for a muted, looping clip with preload="none": fetched and played only while on screen. */
export function playOnScreen(node: HTMLVideoElement): { destroy(): void } {
  node.muted = true;
  node.playsInline = true;
  const looping = loopByHand(node);
  const mayPlay = mayMove();
  if (clipStep(true, mayPlay) === "still") {
    // A clip that never plays still shows a picture: its first frame, which is all it fetches.
    node.preload = "metadata";
    return looping;
  }
  const watcher = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      // A refused play (the browser's own autoplay rules) leaves the frame showing, which is the quiet answer.
      if (clipStep(entry.isIntersecting, mayPlay) === "play") node.play().catch(() => undefined);
      else node.pause();
    }
  });
  watcher.observe(node);
  return {
    destroy() {
      watcher.disconnect();
      looping.destroy();
    },
  };
}
