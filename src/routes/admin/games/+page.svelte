<!--
  The games waiting for staff, oldest first. Each is one paper card that is one link to its page: its name, then what it is
  (a game, or an update to a live one), who sent it and how long it has waited. With none waiting it says so, and that new
  ones show up here, so an empty page is not a dead end.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Games to check · Ruken</title>
</svelte:head>

<main class="games">
  <h1>Games to check</h1>
  {#if data.games.length === 0}
    <p>No games to check right now. New ones show up here.</p>
  {/if}
  {#each data.games as game (game.slug)}
    <a class="game" href={`/admin/games/${game.slug}`}>
      <span>
        <span class="statement">{game.name}</span>
        <!-- "Waiting 3 hours" is never cut, and an email that does not fit moves down whole instead of breaking at a hyphen. -->
        <span>
          <span class="nobreak">{game.kind === "update" ? "Update" : "Game"}</span> ·
          <span class="email">{game.makerEmail}</span> · <span class="nobreak">{game.waited}</span>
        </span>
      </span>
    </a>
  {/each}
</main>
