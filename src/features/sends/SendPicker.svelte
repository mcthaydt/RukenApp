<!--
  The share sheet's "Your turn" (the owner, 2026-11-27 14:48 UTC: "The email in share should be replaced with your turn
  which allows you to select members and send it to them"): inside the same sheet, a face for each friend (people who
  follow each other, newest friendship first). Pressing a face picks it, pressing it again lets it go; Send sends the
  game to everyone picked and says so. Back goes to the rest of the sheet. Signed out it says to sign in; with no
  friends it says what a friend is.
-->
<script lang="ts">
  import { loads } from "../../lib/loads.ts";
  import type { Friend } from "./friend.ts";
  import { SEND_WORDS } from "./words.ts";

  let { game, friends, onback }: { game: string; friends: readonly Friend[] | null; onback: () => void } =
    $props();

  let picked = $state<string[]>([]);
  let sending = $state(false);
  let said = $state("");
  let first = $state<HTMLElement>();

  /** Puts the focus on the first thing to press: a face, or the way to sign in. */
  export function focusFirst(): void {
    first?.focus();
  }

  const initialOf = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? "";

  function toggle(handle: string): void {
    said = "";
    picked = picked.includes(handle) ? picked.filter((one) => one !== handle) : [...picked, handle];
  }

  async function sendOne(handle: string): Promise<"sent" | "failed" | "limited"> {
    const form = new FormData();
    form.set("game", game);
    form.set("to", handle);
    try {
      const answer = await fetch("/your-turn/send", {
        method: "POST",
        body: form,
        headers: { accept: "application/json" },
      });
      return answer.ok ? "sent" : answer.status === 429 ? "limited" : "failed";
    } catch {
      return "failed";
    }
  }

  async function send(): Promise<void> {
    if (sending || friends === null) return;
    if (picked.length === 0) {
      said = SEND_WORDS.pickFirst;
      return;
    }
    sending = true;
    said = "";
    const going = [...picked];
    const outcomes = await Promise.all(going.map(sendOne));
    const went = going.filter((_, index) => outcomes[index] === "sent");
    // What did not go stays picked, so Send tries it again.
    picked = going.filter((_, index) => outcomes[index] !== "sent");
    const names = went.map((handle) => friends.find((one) => one.handle === handle)?.name ?? "");
    if (outcomes.includes("limited")) said = SEND_WORDS.limited;
    else if (outcomes.includes("failed")) said = SEND_WORDS.failed;
    else said = SEND_WORDS.sentTo(names);
    sending = false;
  }
</script>

<!-- The sheet's own title says "Send to friends" while this shows, so it reads like the other pull-up panels: one title,
     the game's name, then what to do. -->
<section class="friendpick" aria-labelledby="share-title">
  {#if friends === null}
    <p>{SEND_WORDS.signInToSend}</p>
    <a class="button main" bind:this={first} href={`/sign-in?next=${encodeURIComponent(`/g/${game}`)}`}
      >{SEND_WORDS.signIn}</a
    >
  {:else if friends.length === 0}
    <p>{SEND_WORDS.noFriends}</p>
  {:else}
    <ul>
      {#each friends as friend, index (friend.handle)}
        {@const on = picked.includes(friend.handle)}
        <li>
          {#if index === 0}
            <button
              type="button"
              class="face"
              class:on
              bind:this={first}
              aria-pressed={on}
              onclick={() => {
                toggle(friend.handle);
              }}
            >
              {@render face(friend, on)}
            </button>
          {:else}
            <button
              type="button"
              class="face"
              class:on
              aria-pressed={on}
              onclick={() => {
                toggle(friend.handle);
              }}
            >
              {@render face(friend, on)}
            </button>
          {/if}
        </li>
      {/each}
    </ul>
    <button
      type="button"
      class="main"
      aria-busy={sending ? "true" : undefined}
      aria-disabled={sending ? "true" : undefined}
      onclick={() => void send()}>{SEND_WORDS.send}</button
    >
  {/if}
  <p class="said" role="status">{said}</p>
  <button type="button" class="quiet back" onclick={onback}>{SEND_WORDS.back}</button>
</section>

{#snippet face(friend: Friend, on: boolean)}
  <span class="round" aria-hidden="true">
    {#if friend.photo !== null}
      <img use:loads src={friend.photo} alt="" width="48" height="48" loading="lazy" />
    {:else}
      <span class="initial">{initialOf(friend.name)}</span>
    {/if}
    {#if on}
      <span class="tick">
        <svg viewBox="0 0 24 24" width="20" height="20" focusable="false"
          ><path d="M5 12.5l4.5 4.5L19 7.5" /></svg
        >
      </span>
    {/if}
  </span>
  <span class="name">{friend.name}</span>
{/snippet}

<style>
  .friendpick {
    display: grid;
    gap: 0.75rem;
  }
  p {
    margin: 0;
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
    position: relative;
    display: grid;
    place-items: center;
    width: var(--size-target);
    height: var(--size-target);
    border-radius: 50%;
    --corner: round;
    background: var(--glass-safe);
    color: var(--chalk);
    box-shadow: var(--glass-edge);
  }
  .round img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    --corner: round;
    object-fit: cover;
  }
  /* Picked: a ring round the face and a green tick on it. */
  .on .round {
    box-shadow: 0 0 0 3px var(--sage);
  }
  .tick {
    position: absolute;
    right: -0.375rem;
    bottom: -0.375rem;
    display: grid;
    place-items: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    --corner: round;
    background: var(--glass-safe);
    color: var(--chalk);
  }
  .tick svg {
    fill: none;
    stroke: currentColor;
    stroke-width: 3;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .initial {
    font-weight: 600;
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
  .main {
    width: 100%;
    background: var(--glass-pay);
    box-shadow: var(--glass-edge);
  }
  .said {
    font-weight: 600;
    text-align: center;
  }
  .said:empty {
    margin-block: -0.375rem;
  }
  /* The same coloured glass as the sheet's other buttons: Send in the pay blue, Back in the quiet green. */
  .back {
    width: 100%;
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
</style>
