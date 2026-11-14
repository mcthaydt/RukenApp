<!--
  The maker's area. One list: each game is one link as a whole, with its name, where it stands and what to do next, in
  words. With none, what a maker needs ready and the same button. The one next step on the screen is "Add a game".
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Your games · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Your games</h1>
  {#if data.games.length === 0}
    <p>You haven't added a game yet.</p>
    <p>You'll need your game on GitHub, ready to run in a browser, and two short videos of it.</p>
  {:else}
    {#each data.games as game (game.slug)}
      <a class="game" href={`/make/${game.slug}`}>
        <span class="statement">{game.name}</span>
        <span>{game.words}</span>
      </a>
    {/each}
  {/if}
  <p class="apart"><a class="button" href="/make/new">Add a game</a></p>
</main>
