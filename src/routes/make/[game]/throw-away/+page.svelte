<!--
  Throwing a game away, which can't be undone. "Keep it" is the way back: the green, safe choice, and the one that has
  focus, so a stray Enter keeps the game. "Throw it away" is the red one. Nothing here is blue and there is no field to
  type in, so Enter has nothing to press but the focused "Keep it".
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  let keep: HTMLAnchorElement | undefined = $state();
  // Focus starts on the safe choice. It is done here and not with the autofocus attribute, which the linter rules out;
  // the page is readable and both choices work before this runs.
  onMount(() => keep?.focus());
</script>

<main class="card">
  <h1>Throw {data.name} away?</h1>
  <p>Its files and videos are deleted from Ruken. Nothing changes on GitHub.</p>
  <p>You can't undo this.</p>
  <!-- The safe choice is first, so a thumb that lands on the first big button keeps the game. -->
  <p><a class="button safe" href={`/make/${data.slug}`} bind:this={keep}>Keep it</a></p>
  <form method="POST" action="/make?/throwAway">
    <input type="hidden" name="game" value={data.slug} />
    <button class="danger">Throw it away</button>
  </form>
</main>
