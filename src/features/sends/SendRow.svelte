<!--
  "Send to a friend", the row at the top of the share sheet (games-sent-to-you brief): a face for each friend, people who
  follow each other, newest friendship first. Pressing a face sends the game to them: the face turns into the spinner
  while it goes, then a green check and "Sent". A failure says so under the face, which can be pressed again. With no
  friends the row is not there, so the sheet is as it always was.
-->
<script lang="ts">
  import { loads } from "../../lib/loads.ts";
  import type { Friend } from "./friend.ts";
  import { SEND_WORDS } from "./words.ts";

  let { game, friends }: { game: string; friends: readonly Friend[] } = $props();

  type State = "ready" | "sending" | "sent" | "failed" | "limited";
  // Kept per game, so the sheet opened again for another game starts afresh.
  let states = $state<Record<string, State>>({});
  $effect.pre(() => {
    if (game !== "") states = {};
  });

  const initialOf = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? "";

  async function send(handle: string): Promise<void> {
    const now = states[handle] ?? "ready";
    if (now === "sending" || now === "sent") return;
    states[handle] = "sending";
    const form = new FormData();
    form.set("game", game);
    form.set("to", handle);
    try {
      const answer = await fetch("/your-turn/send", {
        method: "POST",
        body: form,
        headers: { accept: "application/json" },
      });
      states[handle] = answer.ok ? "sent" : answer.status === 429 ? "limited" : "failed";
    } catch {
      states[handle] = "failed";
    }
  }
</script>

{#if friends.length > 0}
  <section class="send" aria-labelledby="send-title">
    <h3 id="send-title">{SEND_WORDS.row}</h3>
    <ul>
      {#each friends as friend (friend.handle)}
        {@const state = states[friend.handle] ?? "ready"}
        <li>
          <button
            type="button"
            class="face"
            class:sent={state === "sent"}
            aria-label={state === "sent" ? `${SEND_WORDS.sent}: ${friend.name}` : `Send to ${friend.name}`}
            aria-disabled={state === "sending" || state === "sent" ? "true" : undefined}
            aria-busy={state === "sending" ? "true" : undefined}
            onclick={() => void send(friend.handle)}
          >
            <span class="round" aria-hidden="true">
              {#if state === "sent"}
                <svg viewBox="0 0 24 24" width="24" height="24" focusable="false"
                  ><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
                >
              {:else if friend.photo !== null}
                <img use:loads src={friend.photo} alt="" width="48" height="48" loading="lazy" />
              {:else}
                <span class="initial">{initialOf(friend.name)}</span>
              {/if}
            </span>
            <span class="name">{state === "sent" ? SEND_WORDS.sent : friend.name}</span>
          </button>
          {#if state === "failed" || state === "limited"}
            <p class="problem" role="alert">{state === "limited" ? SEND_WORDS.limited : SEND_WORDS.failed}</p>
          {/if}
        </li>
      {/each}
    </ul>
  </section>
{/if}

<style>
  .send {
    display: grid;
    gap: 0.5rem;
  }
  h3 {
    margin: 0;
    font: var(--text-small);
    font-weight: 600;
  }
  ul {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  li {
    display: grid;
    justify-items: center;
    min-width: 0;
  }
  .face {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    width: 100%;
    min-width: var(--size-target);
    min-height: var(--size-target);
    margin: 0;
    padding: 0.25rem 0;
    border: 0;
    border-radius: var(--radius-button);
    background: none;
    color: inherit;
    font: var(--text-small);
    box-shadow: none;
  }
  .round {
    display: grid;
    place-items: center;
    width: var(--size-target);
    height: var(--size-target);
    overflow: hidden;
    border-radius: 50%;
    --corner: round;
    background: var(--paper);
    color: var(--ink);
    box-shadow: var(--glass-edge);
  }
  .sent .round {
    background: var(--glass-safe);
    color: var(--chalk);
  }
  .round img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .initial {
    font-weight: 600;
  }
  svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .name {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .face:focus-visible {
    outline-color: var(--chalk);
  }
  .problem {
    margin: 0.25rem 0 0;
    font: var(--text-small);
    text-align: center;
  }
</style>
