<!--
  The "Text it again" button of a code screen. With a script it shows 30 seconds after the screen does, since the site
  sends one code per number every 30 seconds and an earlier tap would only be told to wait. Without a script it is
  always there, and the site's own "Give it a few seconds" answers an early tap.
-->
<script lang="ts">
  import { onMount } from "svelte";

  const WAIT_SECONDS = 30;
  let waiting = $state(false);

  onMount(() => {
    waiting = true;
    const timer = setTimeout(() => {
      waiting = false;
    }, WAIT_SECONDS * 1000);
    return () => {
      clearTimeout(timer);
    };
  });
</script>

{#if !waiting}
  <button class="quiet" formaction="?/again" formnovalidate>Text it again</button>
{/if}
