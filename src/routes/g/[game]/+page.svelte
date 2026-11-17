<!--
  A game's page, in the order "What players will see" shows the maker: the clip, the name, the one line, who it is for,
  then Play. The clip plays without sound and loops; the tap for sound belongs to the feed. On a phone, a game made for
  a computer says so in one plain line, and its one button shares the link so the person can open it on a computer.
  On a phone, that one button is pinned to the bottom of the window, so it is on the first screen however tall the clip.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  /** What "Share the link" says it did, under the button. Empty until it is pressed. */
  let shared = $state("");

  // The share sheet where the browser has one; otherwise the address is copied. A person who closes the share sheet
  // has chosen not to share, so nothing is said. If neither works, the line says where the address is.
  async function share(): Promise<void> {
    const link = { title: data.name, url: location.href };
    if ("share" in navigator && navigator.canShare(link)) {
      try {
        await navigator.share(link);
        return;
      } catch (problem) {
        if (problem instanceof DOMException && problem.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(location.href);
      shared = "Link copied.";
    } catch {
      shared = "Copy the address from the bar at the top.";
    }
  }
</script>

<svelte:head>
  <title>{data.name} · Ruken</title>
</svelte:head>

<main class="card game">
  <video class="clip" muted loop autoplay playsinline>
    <source src={data.clips.upright} media="(orientation: portrait)" />
    <source src={data.clips.wide} />
  </video>
  <h1>{data.name}</h1>
  <p>{data.oneLine}</p>
  {#if data.rating !== null}
    <p><span class="chip">{data.rating}</span></p>
  {/if}
  {#if data.needsComputer}
    <p>This one needs a computer.</p>
    <div class="acts">
      <p><button type="button" onclick={share}>Share the link</button></p>
      <p aria-live="polite">{shared}</p>
    </div>
  {:else}
    <!-- No preload: opening the play address starts a play (a session and a pass), which only a press may do. -->
    <p class="acts">
      <a class="button" href={`/g/${data.slug}/play`} data-sveltekit-preload-data="off">Play</a>
    </p>
  {/if}
</main>
