// A picture or a video shows a placeholder that shimmers until it has loaded (look.css, `[data-loading]`), so a
// person on a slow line sees something is coming instead of an empty box. Every <img> and <video> takes this action;
// tests/loading-states.test.ts fails on one that does not.

/** Whether a video is still fetching what it needs to show its first frame. */
function videoIsLoading(video: HTMLVideoElement): boolean {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return false;
  // No address yet (the feed sets one only near the screen), or the browser chose not to fetch: nothing is coming.
  return video.networkState === HTMLMediaElement.NETWORK_LOADING;
}

/** A Svelte action: marks an image or a video `data-loading` while it loads. */
export function loads(node: HTMLImageElement | HTMLVideoElement): { destroy(): void } {
  const mark = (loading: boolean) => {
    if (loading) node.setAttribute("data-loading", "");
    else node.removeAttribute("data-loading");
  };
  const done = () => {
    mark(false);
  };

  if (node instanceof HTMLImageElement) {
    mark(!node.complete);
    node.addEventListener("load", done);
    node.addEventListener("error", done);
    // A new address on the same picture (a maker's new photo) loads again, so it shimmers again.
    const newAddress = new MutationObserver(() => {
      mark(!node.complete);
    });
    newAddress.observe(node, { attributes: true, attributeFilter: ["src", "srcset"] });
    return {
      destroy() {
        newAddress.disconnect();
        node.removeEventListener("load", done);
        node.removeEventListener("error", done);
      },
    };
  }

  // A video's address can change (the feed sets it as a clip comes near), so it is looked at again on each event.
  const look = () => {
    mark(videoIsLoading(node));
  };
  const started = () => {
    mark(node.readyState < HTMLMediaElement.HAVE_CURRENT_DATA);
  };
  look();
  const settles = ["loadeddata", "error", "emptied", "suspend", "abort", "stalled"] as const;
  for (const name of settles) node.addEventListener(name, look);
  node.addEventListener("loadstart", started);
  return {
    destroy() {
      for (const name of settles) node.removeEventListener(name, look);
      node.removeEventListener("loadstart", started);
    },
  };
}
