<!--
  The maker's area. Each game is one paper card and the whole card is a link: its picture, its name, and where it
  stands with the one next step, in words. With none, what a maker needs ready. The one blue button is "Add a game".
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Your games · Ruken</title>
</svelte:head>

<main>
  <h1>Your games</h1>
  {#if data.githubFailed}
    <p class="problem" role="alert">GitHub didn't connect. Try again.</p>
  {/if}
  {#if data.games.length === 0}
    <p>You haven't added a game yet.</p>
    <p>You'll need your game on GitHub, ready to run in a browser, and two short videos of it.</p>
  {/if}
  <div class="acts">
    <a class="button" href="/make/new">Add a game</a>
  </div>
  {#each data.games as game (game.slug)}
    <a class="game" href={`/make/${game.slug}`}>
      <!-- The game's picture comes with its videos; until then a plain block holds its place. -->
      <i aria-hidden="true"></i>
      <span>
        <span class="statement">{game.name}</span>
        <span data-sent-back={game.words.startsWith("Sent back") ? "" : undefined}>{game.words}</span>
      </span>
    </a>
  {/each}
</main>
