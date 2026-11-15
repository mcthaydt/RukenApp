<!--
  The games waiting for staff, oldest first. Each is one paper card that is one link to its page: its name, then what it is
  (a game, or an update to a live one), who sent it and how long it has waited. With none waiting it says so.
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
    <p>Nothing is waiting.</p>
  {/if}
  {#each data.games as game (game.slug)}
    <a class="game" href={`/admin/games/${game.slug}`}>
      <span>
        <span class="statement">{game.name}</span>
        <span>{game.kind === "update" ? "Update" : "Game"} · {game.makerEmail} · {game.waited}</span>
      </span>
    </a>
  {/each}
</main>
