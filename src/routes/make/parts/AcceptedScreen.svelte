<!--
  The first time a maker opens a game that a decision day let in (spec 5.2): "You're in." over the game's own video,
  blurred and dimmed as Live has it, and one big blue button on to Live. The button is a form, not a link, because
  opening Ruken's pages ahead of a tap (hover preload) must not use up the one showing. Pressing it writes that the
  maker has seen this, and the next look at the game is Live.
-->
<script lang="ts">
  import { watchUpright } from "./upright.svelte.ts";
  import GameBackdrop from "./GameBackdrop.svelte";

  let {
    name,
    count,
    backdrop,
  }: {
    name: string;
    /** How many games that decision day let in, this one among them. */
    count: number;
    backdrop: { upright: string | null; wide: string | null };
  } = $props();

  const screen = watchUpright();
</script>

<GameBackdrop {backdrop} upright={screen.upright} />

<main class="halves live">
  <div>
    <h1>You're in.</h1>
    <p>{name} is live on Ruken.</p>
    <p class="note">
      {count === 1
        ? "It's the one game that got in this week."
        : `It's one of ${String(count)} games that got in this week.`}
    </p>
    <form method="POST" action="?/seen">
      <div class="acts">
        <button>See your game</button>
      </div>
    </form>
  </div>
</main>
