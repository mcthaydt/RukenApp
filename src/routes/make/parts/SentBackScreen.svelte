<!--
  A game staff sent back. The left half leads with what to do: the line, the one blue button naming the first thing to fix,
  and the way back. "Send it again" is not on the screen while something is left to fix; once nothing is, it is the one
  blue button. The right half has a card for each thing to fix, and what passed folded away in one green card that opens
  onto the game laid out with a Change on every part.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import type { FixCardData, LaidOutGame } from "../laid-out.ts";
  import FixCard from "./FixCard.svelte";
  import GameLaidOut from "./GameLaidOut.svelte";

  let {
    name,
    line,
    fixes,
    accepted,
    game,
    throwAway,
    problem,
  }: {
    name: string;
    line: string;
    fixes: FixCardData[];
    accepted: { count: number; ready: boolean };
    game: LaidOutGame;
    throwAway: string;
    problem: string | undefined;
  } = $props();

  // True from the press until the answer comes: a second press while the first is out would send twice.
  let sending = $state(false);
  const first = $derived(fixes[0]);
</script>

<svelte:head>
  <title>Sent back · Ruken</title>
</svelte:head>

<main class="halves">
  <div>
    <p class="count">{name}</p>
    <h1>Sent back</h1>
    <p>{line}</p>
    {#if problem !== undefined}
      <p class="problem" role="alert">{problem}</p>
    {/if}
    {#if first === undefined}
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
        <div class="acts">
          <button disabled={sending} aria-busy={sending ? "true" : undefined}>
            {sending ? "Sending your game…" : "Send it again"}
          </button>
        </div>
      </form>
    {:else}
      <div class="acts">
        <a class="button" href={first.href}>{first.fixWords}</a>
      </div>
    {/if}
    <a class="foot" href="/make">Back to your games</a>
    <a class="foot" href={throwAway}>Throw this game away</a>
  </div>
  <div class="after">
    {#each fixes as fix (fix.part)}
      <FixCard {fix} />
    {/each}
    <details class="accepted" open={accepted.ready}>
      <summary>
        <span>{accepted.ready ? "All 8 ready to send" : `${accepted.count} accepted`}</span>
        <span class="when-closed">Show</span><span class="when-open">Hide</span>
      </summary>
      <GameLaidOut {game} />
    </details>
  </div>
</main>
