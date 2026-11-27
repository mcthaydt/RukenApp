<!--
  Saved and Your reposts (learned-feed spec, unit G): the live games a person pressed Save or Repost on, the latest first.
  Each row opens the game's page, and the bin beside it takes the game off the list. It is a plain form, so it works
  with no script. A long list scrolls inside its own box; the page stays still.
-->
<script lang="ts">
  import Icon from "../../lib/icon.svelte";
  import type { MarkedGame } from "./services.ts";

  let {
    heading,
    empty,
    games,
    removed,
  }: {
    heading: string;
    /** What the screen says when the list is empty. */
    empty: string;
    games: MarkedGame[];
    /** A game was just taken off. */
    removed: boolean;
  } = $props();
</script>

<main class="card">
  <h1>{heading}</h1>
  {#if removed}
    <p role="status">Removed.</p>
  {/if}
  {#if games.length === 0}
    <p>{empty}</p>
  {:else}
    <ul class="marked">
      {#each games as game (game.slug)}
        <li>
          <a class="game" href={`/g/${game.slug}`}>
            <strong>{game.name}</strong>
            <span class="note">{game.oneLine}</span>
          </a>
          <form method="POST" action="?/remove">
            <input type="hidden" name="game" value={game.slug} />
            <button class="quiet" aria-label={`Remove ${game.name}`}><Icon name="remove" /></button>
          </form>
        </li>
      {/each}
    </ul>
  {/if}
  <p><a class="go" href="/me">Your account</a></p>
</main>

<style>
  .marked {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 50dvh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }
  .game {
    display: flex;
    flex-direction: column;
    min-width: 0;
    min-height: var(--size-target);
    justify-content: center;
    margin: 0;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  form {
    flex: none;
    margin: 0;
  }
</style>
