<!--
  A game its maker took off Ruken: its name over "Taken off Ruken", one line that says what changed, and the one blue
  button that puts it back (it copies the newest files and sends them for review; a person's yes still comes first).
  Laid out as Sent back is: the words and the button on the left, and on the right the game as it will look, with a
  Change on every part, so it can be mended before it goes back. When a delete stopped halfway, a card under the button
  says files are left and offers to delete them. At the foot, the quietest link deletes the game for good (its own
  screen asks first).
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import type { LaidOutGame } from "../laid-out.ts";
  import GameLaidOut from "./GameLaidOut.svelte";

  let {
    name,
    nextStep,
    filesLeft,
    connectAddress,
    game,
    throwAway,
    problem,
  }: {
    name: string;
    nextStep: string | null;
    /** True when some of the game's files are still on Ruken. */
    filesLeft: boolean;
    /** Where a maker chooses their games on GitHub, which mends a refusal that says to. */
    connectAddress: string;
    /** The game laid out, with a Change on every part. */
    game: LaidOutGame;
    /** The question asked before a game is deleted for good. */
    throwAway: string;
    problem: string | undefined;
  } = $props();

  // True from the press until the answer comes: a second press while the first is out would copy twice.
  let sending = $state(false);
</script>

<main class="halves">
  <div>
    <p class="count">{name}</p>
    <h1>Taken off Ruken</h1>
    {#if nextStep !== null}
      <p>{nextStep}</p>
    {/if}
    {#if problem !== undefined}
      <p class="problem" role="alert">{problem}</p>
      <!-- A refusal that says to choose the game on GitHub gets the way to do it, as the files question has. -->
      {#if problem.includes("Choose it on GitHub")}
        <p class="note">
          <a class="quiet" href={connectAddress} data-sveltekit-reload>Choose it on GitHub</a>
        </p>
      {/if}
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
          Put it back on Ruken copies the newest version of your game from GitHub and sends it for review.
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
  </div>
  <GameLaidOut {game} />
</main>
<!-- At the foot of the screen, "there to be found, not read", and never beside the safe way out. -->
<a class="foot" href={throwAway}>Delete it for good</a>
