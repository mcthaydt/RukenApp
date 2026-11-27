<!--
  The ••• sheet on a clip (learned feed spec 6.1): two big buttons, More like this and Less like this, and Cancel, on
  glass over a dimmed screen like the Share sheet, sliding in and away as it does. A press keeps a chip for the game on Your feed, closes the sheet and
  the feed says "Got it." for two seconds. One sheet serves the whole feed: the feed calls `open` with the clip's game.
-->
<script lang="ts">
  import { slideAway, slideAwayOnCancel, stopSliding } from "../../lib/sheet.ts";

  let { onsaved }: { onsaved: () => void } = $props();

  let sheet = $state<HTMLDialogElement>();
  let moreButton = $state<HTMLButtonElement>();
  let game = $state<{ slug: string; name: string } | null>(null);
  let opener: HTMLElement | null = null;
  let busy = $state<"more" | "less" | null>(null);
  let problem = $state("");

  /** Opens the sheet for a game. Focus goes back to `from` when it closes. */
  export function open(which: { slug: string; name: string }, from: HTMLElement | null): void {
    game = which;
    opener = from;
    problem = "";
    busy = null;
    if (sheet === undefined) return;
    stopSliding(sheet);
    sheet.showModal();
    moreButton?.focus();
  }

  async function press(more: boolean): Promise<void> {
    if (game === null || busy !== null) return;
    busy = more ? "more" : "less";
    problem = "";
    try {
      const response = await fetch("/api/feed/taste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game: game.slug, more }),
      });
      if (!response.ok) {
        const answer = await response.json<{ problem?: string }>().catch(() => ({ problem: undefined }));
        problem = answer.problem ?? "That didn't work. Try again.";
        return;
      }
      close();
      onsaved();
    } catch {
      problem = "That didn't work. Check your connection and try again.";
    } finally {
      busy = null;
    }
  }

  function close(): void {
    if (sheet !== undefined) slideAway(sheet);
  }
</script>

<!-- A press on the dimmed screen around the panel closes it; the keyboard has Escape and Cancel. -->
<dialog
  class="tastesheet rises"
  bind:this={sheet}
  aria-labelledby="taste-title"
  onclick={(event) => {
    if (event.target === sheet) close();
  }}
  oncancel={slideAwayOnCancel}
  onclose={() => {
    opener?.focus();
  }}
>
  <div class="inside">
    <h2 id="taste-title">{game?.name ?? ""}</h2>
    <button
      type="button"
      class="main"
      bind:this={moreButton}
      aria-busy={busy === "more" ? "true" : undefined}
      onclick={() => void press(true)}>More like this</button
    >
    <button
      type="button"
      class="main"
      aria-busy={busy === "less" ? "true" : undefined}
      onclick={() => void press(false)}>Less like this</button
    >
    {#if problem !== ""}
      <p class="problem" role="alert">{problem}</p>
    {/if}
    <button type="button" class="quiet cancel" onclick={close}>Cancel</button>
  </div>
</dialog>

<style>
  .tastesheet {
    width: min(24rem, calc(100vw - 2rem));
    max-width: none;
    max-height: calc(100dvh - 2rem);
    margin: auto;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: var(--radius-card);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    text-shadow: var(--glass-ink);
  }
  .tastesheet::backdrop {
    background: var(--dim-bg);
    -webkit-backdrop-filter: var(--dim-filter);
    backdrop-filter: var(--dim-filter);
  }
  .inside {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1.25rem;
  }
  h2 {
    margin: 0;
    font: var(--text-statement);
    overflow-wrap: anywhere;
  }
  .main {
    width: 100%;
    margin: 0;
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
  .cancel {
    align-self: center;
    margin: 0;
  }
  .problem {
    margin: 0;
  }
  @media (orientation: portrait) and (max-width: 47.99rem) {
    .tastesheet {
      width: 100vw;
      margin: auto 0 0;
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }
    .inside {
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
  }
</style>
