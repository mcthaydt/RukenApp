<!--
  Taking a live game off Ruken. Red stays: its files are deleted and it leaves at once, though its maker can put it back
  (it goes through review again). "Keep it on Ruken" is the way back: the green, safe choice, and the
  one that has focus, so a stray Enter keeps the game. "Take it off Ruken" is the red one, the only red thing here. Nothing
  here is blue and there is no field to type in, so Enter has nothing to press but the focused "Keep it on Ruken".
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  let keep: HTMLAnchorElement | undefined = $state();
  // True from the press until the answer comes: a second press while the first is out would ask twice.
  let sending = $state(false);
  // Focus starts on the safe choice. It is done here and not with the autofocus attribute, which the linter rules out;
  // the page is readable and both choices work before this runs.
  onMount(() => keep?.focus());
</script>

<svelte:head>
  <title>Take it off Ruken? · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Take {data.name} off Ruken?</h1>
  <p>Players won't be able to find it or play it any more. Nothing changes on GitHub.</p>
  <p>You can put it back later. We'll check it again first.</p>
  {#if form?.problem !== undefined}
    <p class="problem" role="alert">{form.problem}</p>
  {/if}
  <!-- The safe choice is first, so a thumb that lands on the first big button keeps the game. -->
  <p><a class="button safe" href={`/make/${data.slug}`} bind:this={keep}>Keep it on Ruken</a></p>
  <form
    method="POST"
    action="?/takeOff"
    use:enhance={({ cancel }) => {
      if (sending) cancel();
      sending = true;
      return async ({ update }) => {
        await update();
        sending = false;
      };
    }}
  >
    <button class="danger" disabled={sending}>Take it off Ruken</button>
  </form>
</main>
