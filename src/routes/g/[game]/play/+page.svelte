<!--
  The play screen: the game fills the window, and the one thing of Ruken's is ←, back to where the person came from.
  The first time on a device a short line says what ← does, then leaves after five seconds; with no script it stays.
  ← is a plain link, so it works whatever the game is doing, and leaving the page removes the frame, so a game that
  keeps running while hidden stops.
  While the game is played the page tells the server, every 15 seconds, whether the person was there the whole time:
  the tab showing, the game on screen and the game being what they last touched. It never puts the game in focus
  itself, so time starts only when the person first taps or clicks the game.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { BEAT_EVERY_MS, createAttention } from "../../../../features/play/play.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  /** The device has been shown the line once already. */
  const SEEN = "rk_seen_back";
  /** How long the line stays the first time. */
  const LINE_MS = 5_000;

  let showLine = $state(true);
  let frame: HTMLIFrameElement | undefined = $state();

  // Play time: one look a second, and one at once when the tab is hidden or shown; a beat every BEAT_EVERY_MS; one last
  // beat as the page closes. A beat the server did not take (offline for a moment) is spoken for by the next one.
  onMount(() => {
    const attention = createAttention();
    const beatAt = `/g/${data.slug}/play/beat`;
    const body = () =>
      JSON.stringify({ session: data.session.id, token: data.session.token, attentive: attention.report() });

    function look(): void {
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
        const answer = await fetch(beatAt, { method: "POST", body: body(), keepalive: true });
        if (answer.status === 204) attention.taken();
        // The session has ended or is not known: no beat will ever be taken again.
        if (answer.status === 410 || answer.status === 404) over = true;
      } catch {
        // Offline for a moment: the next beat speaks for this stretch too.
      }
    }

    const looking = setInterval(look, 1_000);
    const beating = setInterval(() => void beat(), BEAT_EVERY_MS);
    const onVisibility = () => {
      look();
    };
    const onLeave = () => {
      look();
      if (!over) navigator.sendBeacon(beatAt, body());
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(looking);
      clearInterval(beating);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
    };
  });

  onMount(() => {
    // Storage can be refused (a private window); then the line shows each time, which is no harm.
    let seen: boolean;
    try {
      seen = localStorage.getItem(SEEN) !== null;
      localStorage.setItem(SEEN, "yes");
    } catch {
      seen = false;
    }
    if (seen) {
      showLine = false;
      return;
    }
    const timer = setTimeout(() => {
      showLine = false;
    }, LINE_MS);
    return () => {
      clearTimeout(timer);
    };
  });
</script>

<svelte:head>
  <title>{data.name} · Ruken</title>
</svelte:head>

<main class="stage">
  <div class="bar">
    <a class="back" href={`/g/${data.slug}`} aria-label="Back to the feed">←</a>
    {#if showLine}
      <p role="status">Tap ← to go back to the feed</p>
    {/if}
  </div>
  <iframe
    bind:this={frame}
    class="frame"
    title={data.name}
    src={data.frame.src}
    sandbox={data.frame.sandbox}
    allow={data.frame.allow}
    referrerpolicy="no-referrer"
  ></iframe>
</main>
