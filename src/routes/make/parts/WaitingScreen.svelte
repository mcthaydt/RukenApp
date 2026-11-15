<!--
  A game waiting for a person's yes: its name over the heading, one line, the one blue button back to Your games, and a
  small way to change something, which goes through Check and send. The game is laid out beside them as members will see
  it, with nothing to change here.
-->
<script lang="ts">
  import type { LaidOutGame } from "../laid-out.ts";
  import GameLaidOut from "./GameLaidOut.svelte";

  let {
    name,
    game,
    changeAddress,
  }: {
    name: string;
    game: LaidOutGame;
    /** Check and send, where a waiting game is changed and sent again. */
    changeAddress: string;
  } = $props();
</script>

<svelte:head>
  <title>Waiting for review · Ruken</title>
</svelte:head>

<main class="halves">
  <div>
    <p class="count">{name}</p>
    <h1>Waiting for review</h1>
    <p>We're looking at it. Come back here to see when it's live.</p>
    <div class="acts">
      <a class="button" href="/make">Back to your games</a>
    </div>
    <a class="foot" href={changeAddress}>Change something</a>
  </div>
  <GameLaidOut {game} />
</main>
