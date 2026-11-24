import { stillOfClip, stillWidthFor } from "./stills.ts";

// A video's still: the clip's opening frame as a picture, shown in the video's own box until the video has a frame of
// its own (the owner, 2026-11-24: "we should do all videos like that, use the first frame until the rest of it loads").
//
// It is the video's own background (look.css, `video[data-still]`), cut and placed as the video's own object-fit and
// object-position cut and place its frames, so it sits exactly where the video plays and nothing moves when it starts.
// Not the `poster` attribute: a browser hides the poster as soon as the video is asked to play, long before its first
// frame has come (seen in Chromium: a playing video still fetching showed nothing), which leaves the empty panel this
// is here to fill.

/** How a background must be sized to match a video's object-fit. */
const FIT_AS_SIZE: Record<string, string> = {
  cover: "cover",
  contain: "contain",
  "scale-down": "contain",
  fill: "100% 100%",
  none: "auto",
};

/** The still's whole address for a video `pixels` wide on the screen (in the screen's own pixels). */
export function posterAddress(address: string, second: number, pixels: number): string {
  return `${address}?at=${String(Math.max(0, Math.floor(second)))}&width=${String(stillWidthFor(pixels))}`;
}

/**
 * A Svelte action: shows the still of `clip` (the clip's address, which may name a start with
 * `#t=`), sized to the video on this screen. Given nothing, it uses the video's own `src`, so a video that has its
 * address from the start needs nothing else; a video that gets its address later (the feed) is given it. A video with
 * no size yet (a column a small screen hides) asks for nothing until it has one, and one that grows asks for a bigger
 * still. A video whose address is not a stored clip's (a file not sent yet) shows no still.
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
      if (shown !== "") clear();
      shown = "";
      widest = 0;
      return;
    }
    if (`${still.address}#${String(still.second)}` !== shown) widest = 0;
    shown = `${still.address}#${String(still.second)}`;
    const pixels = node.getBoundingClientRect().width * (window.devicePixelRatio || 1);
    if (pixels <= 0 || pixels <= widest) return;
    widest = pixels;
    const look = getComputedStyle(node);
    // A whole address: a `url()` inside a custom property is read against the style sheet that uses it, not the page.
    const next = new URL(posterAddress(still.address, still.second, pixels), window.location.href).href;
    node.style.setProperty("--still", `url("${next}")`);
    node.style.setProperty("--still-fit", FIT_AS_SIZE[look.objectFit] ?? "contain");
    node.style.setProperty("--still-at", look.objectPosition || "50% 50%");
    node.setAttribute("data-still", "");
  };
  const clear = () => {
    node.removeAttribute("data-still");
    for (const name of ["--still", "--still-fit", "--still-at"]) node.style.removeProperty(name);
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
