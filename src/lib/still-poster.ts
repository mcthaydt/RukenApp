import { stillWidthFor } from "./still-widths.ts";

// A video's still as its poster: the picture a browser shows in the video's own box, cut and placed by the video's own
// object-fit and object-position, until the video has a frame to show. Being the video's own poster, it can never sit
// anywhere but exactly where the video plays, so nothing moves when it starts.

export interface StillChoice {
  /** Where to ask for the clip's still (from the server), or undefined when the site has none. */
  address: string | undefined;
  /** The second of the clip the video starts at, so the still is the frame the video opens on. */
  second: number;
}

/** The still's whole address for a video `pixels` wide on the screen (in the screen's own pixels). */
export function posterAddress(address: string, second: number, pixels: number): string {
  return `${address}?at=${String(Math.max(0, Math.floor(second)))}&width=${String(stillWidthFor(pixels))}`;
}

/**
 * A Svelte action: sets the video's poster to its still, sized to the video on this screen. A video with no size yet
 * (a column a small screen hides) asks for nothing until it has one, and a video that grows asks for a bigger still.
 */
export function stillPoster(
  node: HTMLVideoElement,
  choice: StillChoice,
): { update(next: StillChoice): void; destroy(): void } {
  let current = choice;
  let widest = 0;
  const set = () => {
    if (current.address === undefined) {
      node.removeAttribute("poster");
      return;
    }
    const pixels = node.getBoundingClientRect().width * (window.devicePixelRatio || 1);
    if (pixels <= 0 || pixels <= widest) return;
    widest = pixels;
    node.poster = posterAddress(current.address, current.second, pixels);
  };
  const watcher = new ResizeObserver(set);
  watcher.observe(node);
  set();
  return {
    update(next) {
      if (next.address !== current.address || next.second !== current.second) widest = 0;
      current = next;
      set();
    },
    destroy() {
      watcher.disconnect();
    },
  };
}
