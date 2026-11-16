<!--
  The games waiting for staff, oldest first. Each is one paper card that is one link to its page: its name, then what it is
  (a game, or an update to a live one), who sent it and how long it has waited. With none waiting it says so, and that new
  ones show up here, so an empty page is not a dead end. Above them, once, is what the last decision did ("Tiny game is
  live."), so a person who has pressed Accept or Send back can tell it went through.
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
  {#if data.said !== null}
    <p role="status">{data.said}</p>
  {/if}
  {#if data.games.length === 0}
    <p>No games to check right now. New ones show up here.</p>
  {/if}
  {#each data.games as game (game.slug)}
    <a class="game" href={`/admin/games/${game.slug}`}>
      <span>
        <span class="statement">{game.name}</span>
        <!-- "Waiting 3 hours" is never cut, a dot stays with the words after it, and an email that does not fit moves down
             whole instead of breaking at a hyphen. -->
        <span class="facts">
          <span class="nobreak">{game.kind === "update" ? "Update" : "Game"}</span>
          <span class="email">·&nbsp;{game.makerEmail}</span> ·&nbsp;<span class="nobreak">{game.waited}</span
          >
        </span>
      </span>
    </a>
  {/each}
</main>
