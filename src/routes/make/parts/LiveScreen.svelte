<!--
  A game that is live (spec 5c). Its own video fills the screen behind everything (GameBackdrop). In front: the line,
  the blue button for what to do next, and the way back. What to do next is the send ("Send a new
  version", which copies the newest files and sends them for review in the one press, or, once staff sent back a name,
  a line and it is mended, "Send it again", which sends the copy Ruken already holds, no copy from
  GitHub), or, while something that was sent back is to be fixed, the fix, with the send a quiet outline under it. While
  one of those is still to mend there is no send at all. There is no "See it on Ruken" until a game has a page of its
  own for players. At the foot, under the way back, the quietest link takes the game off Ruken (the agreement's first point). Beside them the game
  laid out sharp, with a Change on its name and its line only: its rating, files and videos go through
  staff again. Only the video of this window's shape is laid out, with the name, the line and the chip (who it is
  for). An update that was sent back is a card.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import type { FixCardData, LaidOutGame } from "../laid-out.ts";
  import FixCard from "./FixCard.svelte";
  import GameBackdrop from "./GameBackdrop.svelte";
  import GameLaidOut from "./GameLaidOut.svelte";
  import { watchUpright } from "./upright.svelte.ts";

  let {
    line,
    send,
    updateWaiting,
    fixes,
    takeOffAddress,
    backdrop,
    game,
    problem,
  }: {
    line: string;
    /** Which send is offered: a new version from GitHub, the held copy again, or none until what was sent back is mended. */
    send: "new_version" | "again" | "none";
    /** True while an update waits for review: a new version sent now takes its place, and the note says so. */
    updateWaiting: boolean;
    fixes: FixCardData[];
    /** Where a maker is asked whether to take the game off Ruken. */
    takeOffAddress: string;
    backdrop: { upright: string | null; wide: string | null };
    game: LaidOutGame;
    problem: string | undefined;
  } = $props();

  // True from the press until the answer comes: a second press while the first is out would send twice.
  let sending = $state(false);
  const screen = watchUpright();
  // The first thing sent back that a link can mend, which the blue button names (as on Sent back).
  const first = $derived(fixes.find((fix) => fix.href !== null));
</script>

<svelte:head>
  <title>Live · Ruken</title>
</svelte:head>

<GameBackdrop {backdrop} upright={screen.upright} />

<!-- The send: the blue button in the bar when it is what to do next, otherwise a quiet outline under the main button. -->
{#snippet sendForm(main: boolean)}
  <form
    method="POST"
    action={send === "again" ? "?/sendAgain" : "?/newVersion"}
    use:enhance={({ cancel }) => {
      if (sending) cancel();
      sending = true;
      return async ({ update }) => {
        await update();
        sending = false;
      };
    }}
  >
    {#snippet label()}
      {#if send === "again"}
        {sending ? "Sending your update…" : "Send it again"}
      {:else}
        {sending ? "Copying your game…" : "Send a new version"}
      {/if}
    {/snippet}
    {#if main}
      <div class="acts">
        <button disabled={sending} aria-busy={sending ? "true" : undefined}>{@render label()}</button>
      </div>
    {:else}
      <button class="outline" disabled={sending} aria-busy={sending ? "true" : undefined}>
        {@render label()}
      </button>
    {/if}
    <p class="note">
      {#if send === "again"}
        Sends your update for review again. Players can still play it while you wait.
      {:else if sending}
        Copying your game can take a minute. Keep this page open.
      {:else}
        Copies the newest version of your game from GitHub and sends it for review.
        {#if updateWaiting}
          It takes the place of the one that is waiting.
        {/if}
        Players can still play it while you wait.
      {/if}
    </p>
  </form>
{/snippet}

<main class="halves live">
  <div>
    <h1>Live</h1>
    <p>{line}</p>
    {#if problem !== undefined}
      <p class="problem" role="alert">{problem}</p>
    {/if}
    {#if first?.href !== undefined && first.href !== null}
      <div class="acts">
        <a class="button" href={first.href}>{first.fixWords}</a>
      </div>
      {#if send === "new_version"}
        {@render sendForm(false)}
      {/if}
    {:else if send !== "none"}
      <!-- A send waiting on the maker is what to do next, so it is the blue button, as on Sent back. -->
      {@render sendForm(true)}
    {/if}
    <a class="foot" href="/make">Back to your games</a>
    <!-- Last, smaller and dimmer than Back, and clear of the blue button's note above, so it is never read as part of it. -->
    <a class="foot" href={takeOffAddress} data-off>Take it off Ruken</a>
  </div>
  <div class="after">
    {#each fixes as fix (fix.part)}
      <FixCard {fix} />
    {/each}
    <!-- One video: the shape this window is, as the backdrop (spec 5c). -->
    <GameLaidOut {game} only={screen.upright ? "upright" : "wide"} />
  </div>
</main>
