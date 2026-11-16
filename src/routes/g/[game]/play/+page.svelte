<!--
  The play screen: the game fills the window, and the one thing of Ruken's is ←, back to where the person came from.
  The first time on a device a short line says what ← does, then leaves after five seconds; with no script it stays.
  ← is a plain link, so it works whatever the game is doing, and leaving the page removes the frame, so a game that
  keeps running while hidden stops.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  /** The device has been shown the line once already. */
  const SEEN = "rk_seen_back";
  /** How long the line stays the first time. */
  const LINE_MS = 5_000;

  let showLine = $state(true);

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
    class="frame"
    title={data.name}
    src={data.frame.src}
    sandbox={data.frame.sandbox}
    allow={data.frame.allow}
    referrerpolicy="no-referrer"
  ></iframe>
</main>
