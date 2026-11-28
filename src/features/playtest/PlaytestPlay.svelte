<!--
  A playtester's Play (playtesting spec): in place of Wishlist, Play with a small Playtest tag in it, and one line under
  it saying they play free until Ruken opens. It keeps the screen's own Play class, so the feed's Enter and gamepad A
  start it as they start any Play.
-->
<script lang="ts">
  import { PLAYTEST_WORDS } from "./words.ts";

  interface Props {
    slug: string;
    /** The screen's own class for its main button, as Wishlist takes it. */
    buttonClass: string;
  }

  let { slug, buttonClass }: Props = $props();
</script>

<div class="playtestplay">
  <!-- Opening the game counts a play, so it never loads ahead of a press. -->
  <a class={buttonClass} data-sveltekit-preload-data="off" href={`/g/${slug}/play`}
    ><span>Play</span> <span class="tag">{PLAYTEST_WORDS.tag}</span></a
  >
  <p class="free">{PLAYTEST_WORDS.freeUntil}</p>
</div>
