<!--
  A game's own video filling the screen behind everything, blurred and dimmed (spec 5c): the upright one on an upright
  screen and the wide one on a wide screen. It moves only where a video may move by itself (quietVideo), and so do the
  five soft circles in front of it. Live and Accepted share it.
-->
<script lang="ts">
  import { loads } from "../../../lib/loads.ts";
  import { onMount } from "svelte";
  import { mayMove, quietVideo } from "../../../lib/quiet-video.ts";

  let { backdrop, upright }: { backdrop: { upright: string | null; wide: string | null }; upright: boolean } =
    $props();

  // Whether the circles drift: only where the video moves too, so a slow phone or a person who asked for less motion sees both still.
  let drifting = $state(false);
  const src = $derived(upright ? (backdrop.upright ?? backdrop.wide) : (backdrop.wide ?? backdrop.upright));

  onMount(() => {
    drifting = mayMove();
  });
</script>

{#if src !== null}
  <div class="backdrop" aria-hidden="true" data-drifting={drifting ? "" : undefined}>
    {#key src}
      <video use:loads {src} preload="metadata" muted loop playsinline use:quietVideo></video>
    {/key}
    <!-- Five soft circles between the video and the dark layer (Owner, 2026-11-15: circles are allowed here only). -->
    {#each [1, 2, 3, 4, 5] as circle (circle)}
      <i class="drift"></i>
    {/each}
  </div>
{/if}
