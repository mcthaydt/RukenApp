<!--
  A game waiting for a person's yes: the heading, one line, the one blue button back to Your games, and a
  small way to change something, which goes through Check and send. Under it, at the foot of the page, the quietest link
  throws the game away (its own screen asks first). When the newest copy of its files from GitHub was
  refused, the line says so and leads to the files question, so the refusal is not found only by changing something.
  The game is laid out beside them as members will see it. Its name is said once, as that card's title, so a long name
  is not read twice on one screen.
-->
<script lang="ts">
  import type { LaidOutGame } from "../laid-out.ts";
  import GameLaidOut from "./GameLaidOut.svelte";

  let {
    game,
    line,
    changeAddress,
    filesProblem,
    filesAddress,
    throwAway,
  }: {
    game: LaidOutGame;
    /** What the game is told while it waits (when decisions go out, or that someone is looking). */
    line: string;
    /** Check and send, where a waiting game is changed and sent again. */
    changeAddress: string;
    /** What was wrong with the newest copy of the game's files from GitHub, or null when the copy passed. */
    filesProblem: string | null;
    /** The files question, where the game is chosen again. */
    filesAddress: string;
    /** The question asked before a game is thrown away. */
    throwAway: string;
  } = $props();
</script>

<main class="halves">
  <div>
    <h1>Waiting for review</h1>
    <p>{line}</p>
    {#if filesProblem !== null}
      <p class="problem" role="alert">{filesProblem}</p>
      <p><a class="quiet" href={filesAddress}>Fix your files</a></p>
    {/if}
    <div class="acts">
      <a class="button" href="/make">Back to your games</a>
    </div>
    <a class="foot" href={changeAddress}>Change something</a>
  </div>
  <GameLaidOut {game} />
</main>
<!-- At the foot of the screen, "there to be found, not read", and never beside the way back. -->
<a class="foot" href={throwAway}>Throw it away</a>
