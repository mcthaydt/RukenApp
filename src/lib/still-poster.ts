import { stillOfClip, stillWidthFor } from "./stills.ts";

// A video's still as its poster: the picture a browser shows in the video's own box, cut and placed by the video's own
// object-fit and object-position, until the video has a frame to show (the owner, 2026-11-24: "we should do all videos
// like that, use the first frame until the rest of it loads"). Being the video's own poster, it can never sit anywhere
// but exactly where the video plays, so nothing moves when it starts.

/** The still's whole address for a video `pixels` wide on the screen (in the screen's own pixels). */
export function posterAddress(address: string, second: number, pixels: number): string {
  return `${address}?at=${String(Math.max(0, Math.floor(second)))}&width=${String(stillWidthFor(pixels))}`;
}

/**
 * A Svelte action: sets the video's poster to the still of `clip` (the clip's address, which may name a start with
 * `#t=`), sized to the video on this screen. Given nothing, it uses the video's own `src`, so a video that has its
 * address from the start needs nothing else; a video that gets its address later (the feed) is given it. A video with
 * no size yet (a column a small screen hides) asks for nothing until it has one, and one that grows asks for a bigger
 * still. A video whose address is not a stored clip's (a file not sent yet) keeps no poster.
 */
export function stillPoster(
  node: HTMLVideoElement,
  clip?: string,
): { update(next?: string): void; destroy(): void } {
  let current = clip;
  let shown = "";
  let widest = 0;
  const set = () => {
    const still = stillOfClip(current ?? node.getAttribute("src") ?? "");
    if (still === null) {
      if (shown !== "") node.removeAttribute("poster");
      shown = "";
      widest = 0;
      return;
    }
    if (`${still.address}#${String(still.second)}` !== shown) widest = 0;
    shown = `${still.address}#${String(still.second)}`;
    const pixels = node.getBoundingClientRect().width * (window.devicePixelRatio || 1);
    if (pixels <= 0 || pixels <= widest) return;
    widest = pixels;
    const next = posterAddress(still.address, still.second, pixels);
    if (node.getAttribute("poster") !== next) node.poster = next;
  };
  const watcher = new ResizeObserver(set);
  watcher.observe(node);
  // A video given its address later, or a new one (a maker's new clip), gets the new still.
  const newAddress = new MutationObserver(set);
  newAddress.observe(node, { attributes: true, attributeFilter: ["src"] });
  set();
  return {
    update(next) {
      current = next;
      set();
    },
    destroy() {
      watcher.disconnect();
      newAddress.disconnect();
    },
  };
}
