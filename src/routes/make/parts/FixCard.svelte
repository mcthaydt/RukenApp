<!--
  One thing staff sent back: a white sheet with a blue edge and a plain label, the part's title, what is wrong in plain
  words, staff's own line under them when they wrote one, the video itself when the part is a video, and "Fix this". The
  whole card is one link to the question that fixes it, so a video here is a plain video and never a link of its own. A
  card with nowhere to go (a live game's files, mended on GitHub) is the same sheet without the link and without "Fix this".
-->
<script lang="ts">
  import { quietVideo } from "../../../lib/quiet-video.ts";
  import type { FixCardData } from "../laid-out.ts";

  let { fix }: { fix: FixCardData } = $props();
</script>

{#snippet card()}
  <span class="fixlabel">Needs fixing</span>
  <span class="statement">{fix.title}</span>
  <span class="say">{fix.words}</span>
  {#if fix.note !== null}
    <span class="note">{fix.note}</span>
  {/if}
  {#if fix.video !== null}
    <video
      data-shape={fix.video.shape}
      src={`${fix.video.src}#t=0.001`}
      preload="metadata"
      muted
      loop
      playsinline
      aria-hidden="true"
      use:quietVideo
    ></video>
  {/if}
  {#if fix.href !== null}
    <span class="fixgo">Fix this</span>
  {/if}
{/snippet}

{#if fix.href === null}
  <div class="sheet fix">{@render card()}</div>
{:else}
  <a class="sheet fix" href={fix.href}>{@render card()}</a>
{/if}
