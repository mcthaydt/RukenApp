<!--
  A game its maker took off Ruken: its name over "Taken off Ruken", one line that says what changed, and the one blue
  button that puts it back (it copies the newest files and sends them for review; a person's yes still comes first).
  Laid out as the other state screens are, so on a wide window it starts at the top left and upright the button is in
  the bar at the bottom. When a delete stopped halfway, a card under it says files are left and offers to delete them.
-->
<script lang="ts">
  import { enhance } from "$app/forms";

  let {
    name,
    nextStep,
    filesLeft,
    problem,
  }: {
    name: string;
    nextStep: string | null;
    /** True when some of the game's files are still on Ruken. */
    filesLeft: boolean;
    problem: string | undefined;
  } = $props();

  // True from the press until the answer comes: a second press while the first is out would copy twice.
  let sending = $state(false);
</script>

<svelte:head>
  <title>Your game · Ruken</title>
</svelte:head>

<main data-state>
  <p class="count">{name}</p>
  <h1>Taken off Ruken</h1>
  {#if nextStep !== null}
    <p>{nextStep}</p>
  {/if}
  {#if problem !== undefined}
    <p class="problem" role="alert">{problem}</p>
  {/if}
  <form
    method="POST"
    action="?/putBack"
    use:enhance={({ cancel }) => {
      if (sending) cancel();
      sending = true;
      return async ({ update }) => {
        await update();
        sending = false;
      };
    }}
  >
    <div class="acts">
      <button disabled={sending} aria-busy={sending ? "true" : undefined}>
        {sending ? "Copying your game…" : "Put it back on Ruken"}
      </button>
    </div>
    <p class="note">
      {#if sending}
        Copying your game can take a minute. Keep this page open.
      {:else}
        Copies the newest version of your game from GitHub and sends it for review.
      {/if}
    </p>
  </form>
  {#if filesLeft}
    <div class="sheet fix">
      <span class="say">Some of its files are still on Ruken.</span>
      <form method="POST" action="?/deleteLeft">
        <button class="danger">Delete them</button>
      </form>
    </div>
  {/if}
  <a class="foot" href="/make">Back to your games</a>
</main>
