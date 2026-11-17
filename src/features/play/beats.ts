// A page that shows a game in a frame tells the server, every BEAT_EVERY_MS, whether the person was there the whole
// stretch: the tab showing, the frame on screen and the frame being what they last touched. One look a second, one at
// once when the tab is hidden or shown, and one last beat as the page closes. A beat the server did not take (offline
// for a moment) is spoken for by the next one. The play page and staff's check page both use it, so staff's own play
// is counted the same way a member's is.

import { createAttention } from "./attention.ts";
import { BEAT_EVERY_MS } from "./time.ts";

/** Starts the beats. The answer stops them and sends the stretch since the last beat, once. */
export function startBeats(options: {
  /** Where the beats go: `/g/<game>/play/beat`. */
  beatAt: string;
  session: { id: string; token: string };
  /** The game's frame, read at each look, since a page may put it in after the beats start. */
  frame: () => HTMLIFrameElement | undefined;
}): () => void {
  const attention = createAttention();
  const body = () =>
    JSON.stringify({
      session: options.session.id,
      token: options.session.token,
      attentive: attention.report(),
    });

  function look(): void {
    const frame = options.frame();
    const box = frame?.getBoundingClientRect();
    attention.look({
      tabShowing: document.visibilityState === "visible",
      frameOnScreen:
        box !== undefined &&
        box.width > 0 &&
        box.height > 0 &&
        box.bottom > 0 &&
        box.right > 0 &&
        box.top < window.innerHeight &&
        box.left < window.innerWidth,
      frameFocused: frame !== undefined && document.activeElement === frame && document.hasFocus(),
    });
  }

  let over = false;
  async function beat(): Promise<void> {
    if (over) return;
    try {
      const answer = await fetch(options.beatAt, { method: "POST", body: body(), keepalive: true });
      if (answer.status === 204) attention.taken();
      // The session has ended or is not known: no beat will ever be taken again.
      if (answer.status === 410 || answer.status === 404) over = true;
    } catch {
      // Offline for a moment: the next beat speaks for this stretch too.
    }
  }

  const looking = setInterval(look, 1_000);
  const beating = setInterval(() => void beat(), BEAT_EVERY_MS);
  // Leaving sends the stretch since the last beat, once. It happens on `pagehide` (the tab closes, the address
  // changes) and when a link takes the person elsewhere inside the site, which never fires `pagehide`. It does not
  // look first: by then a menu or a button may have moved the focus off the game, and that is not looking away.
  let left = false;
  const leave = () => {
    if (left || over) return;
    left = true;
    navigator.sendBeacon(options.beatAt, body());
  };
  document.addEventListener("visibilitychange", look);
  window.addEventListener("pagehide", leave);
  return () => {
    clearInterval(looking);
    clearInterval(beating);
    document.removeEventListener("visibilitychange", look);
    window.removeEventListener("pagehide", leave);
    leave();
  };
}
