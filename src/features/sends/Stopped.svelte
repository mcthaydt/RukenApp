<!--
  The people a person stopped sending them games (games-sent-to-you brief, "Stop someone"), each with Undo, which lets
  their new games through again. A plain form, so it works with no script.
-->
<script lang="ts">
  import type { StoppedPerson } from "./stopped.ts";
  import { SEND_WORDS } from "./words.ts";

  let { people }: { people: readonly StoppedPerson[] } = $props();
</script>

<main class="card">
  <h1>{SEND_WORDS.stoppedTitle}</h1>
  {#if people.length === 0}
    <p>{SEND_WORDS.stoppedEmpty}</p>
  {:else}
    <ul class="people">
      {#each people as person (person.id)}
        {@const name = person.name ?? SEND_WORDS.someone}
        <li>
          <span>{name}</span>
          <form method="POST" action="?/undo">
            <input type="hidden" name="id" value={person.id} />
            <button class="quiet" aria-label={SEND_WORDS.undoLabel(name)}>{SEND_WORDS.undo}</button>
          </form>
        </li>
      {/each}
    </ul>
  {/if}
  <p><a class="go" href="/your-turn">{SEND_WORDS.tab}</a></p>
</main>

<style>
  .people {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 50dvh;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    list-style: none;
  }
  li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    overflow-wrap: anywhere;
  }
  form {
    flex: none;
    margin: 0;
  }
</style>
