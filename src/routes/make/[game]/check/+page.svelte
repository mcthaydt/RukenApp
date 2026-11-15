<!--
  Check and send, the last step: "Last step" over the heading, the one blue button, and beside them the game laid out as
  members will see it, with a Change on each part. With script, a press says it is sending and cannot be pressed twice.
  Two halves on a wide window, stacked on a narrow one with the button in the bar (spec 15.2).
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import GameLaidOut from "../../parts/GameLaidOut.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // True from the press until the answer comes: a second press while the first is out would send twice.
  let sending = $state(false);
</script>

<svelte:head>
  <title>Check it, then send · Ruken</title>
</svelte:head>

<main class="halves">
  <form
    method="POST"
    action="?/send"
    use:enhance={({ cancel }) => {
      if (sending) cancel();
      sending = true;
      return async ({ update }) => {
        await update();
        sending = false;
      };
    }}
  >
    <p class="count">Last step</p>
    <h1>Check it, then send</h1>
    {#if form?.problem !== undefined}
      <p class="problem" role="alert">{form.problem}</p>
    {/if}
    <div class="acts">
      <button disabled={sending} aria-busy={sending ? "true" : undefined}>
        {sending ? "Sending your game…" : "Send for review"}
      </button>
      <span class="key">press Enter <kbd>↵</kbd></span>
    </div>
    {#if data.throwAway !== null}
      <a class="foot" href={data.throwAway}>Throw this game away</a>
    {/if}
  </form>
  <GameLaidOut game={data.game} />
</main>
