<!--
  The maker's area. One list: each game's name, which links to its page, and where it stands in words. With none, one
  line and the same button. The one next step on the screen is "Add a game".
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
  {:else}
    {#each data.games as game (game.slug)}
      <p>
        <a href={`/make/${game.slug}`}>{game.name}</a>
        <br />
        {game.words}
      </p>
    {/each}
  {/if}
  <p><a class="button" href="/make/new">Add a game</a></p>
</main>
