<!--
  The Your turn tab's list (games-sent-to-you brief): the games friends sent this person, newest first. Each row opens
  the game's page; beside it, Remove takes it off at once, and under the sender's name a → button stops that person
  sending more, after asking once. Nothing moves under it, so it is plain page colours, not glass. The list scrolls
  inside its own box; the page stays still. The screen's top bar (the feed's tabs) is the route's, not this one's.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { refreshAll } from "$app/navigation";
  import Icon from "../../lib/icon.svelte";
  import { loads } from "../../lib/loads.ts";
  import { SEND_WORDS, whenWords } from "./words.ts";

  interface Row {
    id: string;
    slug: string;
    name: string;
    still: string | null;
    from: string | null;
    sentAt: string;
  }

  let {
    signedIn,
    games = [],
    news = false,
    onseen = () => {},
  }: { signedIn: boolean; games?: readonly Row[]; news?: boolean; onseen?: () => void } = $props();

  // Rows taken off here before the site said so; a failure puts the row back.
  let gone = $state<string[]>([]);
  let failed = $state<string | null>(null);
  const shown = $derived(games.filter((game) => !gone.includes(game.id)));

  // The day words are worked out where the person is: the site renders them in its own zone, the browser puts them right.
  let now = $state(new Date());
  let zone = $state<string | undefined>("UTC");
  const from = (row: Row): string => row.from ?? SEND_WORDS.someone;

  onMount(() => {
    now = new Date();
    zone = undefined;
  });
  // The list is on screen, so what is on it is seen: the dot goes. Nobody waits on this. Again when a quiet refresh
  // brings a game sent since the page on screen was asked for (src/features/feed/kept.svelte.ts).
  $effect(() => {
    if (!signedIn || !news) return;
    void fetch("/your-turn/seen", { method: "POST" }).then((answer) => {
      if (!answer.ok) return;
      onseen();
    });
  });

  async function remove(event: SubmitEvent & { currentTarget: HTMLFormElement }, id: string): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    gone = [...gone, id];
    failed = null;
    try {
      const answer = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { accept: "application/json" },
      });
      if (!answer.ok) throw new Error(`the site answered ${String(answer.status)}`);
    } catch {
      gone = gone.filter((one) => one !== id);
      failed = id;
    }
  }

  let stopCard = $state<HTMLDialogElement>();
  let stopping = $state<Row | null>(null);
  let stopOpener: HTMLElement | null = null;

  // Stop is sent from here, not as a plain form: the answer is the route's own, and the list is read again after, so
  // every game from that person goes at once. A failure keeps the card open and says so.
  let stopFailed = $state(false);
  async function stop(event: SubmitEvent & { currentTarget: HTMLFormElement }): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    stopFailed = false;
    try {
      const answer = await fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { accept: "application/json" },
      });
      if (!answer.ok) throw new Error(`the site answered ${String(answer.status)}`);
      await refreshAll();
      stopCard?.close();
    } catch {
      stopFailed = true;
    }
  }

  function askStop(row: Row, from: HTMLElement): void {
    stopFailed = false;
    stopping = row;
    stopOpener = from;
    stopCard?.showModal();
  }
</script>

<main class="yourturn" aria-busy="false">
  {#if !signedIn}
    <div class="empty">
      <p class="statement">{SEND_WORDS.signedOut}</p>
      <a class="button" href={`/sign-in?next=${encodeURIComponent("/your-turn")}`}>{SEND_WORDS.signIn}</a>
    </div>
  {:else if shown.length === 0}
    <div class="empty">
      <p class="statement">{SEND_WORDS.empty}</p>
      <a class="button" href="/">{SEND_WORDS.everyGame}</a>
    </div>
  {:else}
    <ul class="list">
      {#each shown as row (row.id)}
        <li>
          <a class="sentgame" href={`/g/${row.slug}`}>
            {#if row.still !== null}
              <img use:loads src={row.still} alt="" width="64" height="64" loading="lazy" />
            {:else}
              <span class="still" aria-hidden="true"></span>
            {/if}
            <span class="words">
              <strong>{row.name}</strong>
              <span>{SEND_WORDS.from(from(row))}</span>
              <span class="when">{whenWords(new Date(row.sentAt), now, zone)}</span>
            </span>
          </a>
          <form method="POST" action="/your-turn/remove" onsubmit={(event) => void remove(event, row.id)}>
            <input type="hidden" name="id" value={row.id} />
            <button class="quiet remove" aria-label={SEND_WORDS.remove(row.name)}
              ><Icon name="remove" /></button
            >
          </form>
          <button
            type="button"
            class="go stop"
            onclick={(event) => {
              askStop(row, event.currentTarget);
            }}
          >
            {SEND_WORDS.stop(from(row))}
          </button>
          {#if failed === row.id}
            <p class="problem" role="alert">{SEND_WORDS.failed}</p>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
  {#if signedIn}
    <p class="more"><a class="go" href="/your-turn/stopped">{SEND_WORDS.stoppedLink}</a></p>
  {/if}
</main>

<dialog
  class="stopcard"
  bind:this={stopCard}
  aria-labelledby="stop-title"
  onclose={() => {
    stopOpener?.focus();
  }}
>
  {#if stopping !== null}
    <h2 id="stop-title">{SEND_WORDS.stopAsk(from(stopping))}</h2>
    <form method="POST" action="/your-turn/stop" onsubmit={(event) => void stop(event)}>
      <input type="hidden" name="id" value={stopping.id} />
      <button class="danger">{SEND_WORDS.stopYes}</button>
    </form>
    <button type="button" class="quiet" onclick={() => stopCard?.close()}>{SEND_WORDS.stopNo}</button>
    {#if stopFailed}
      <p class="problem" role="alert">{SEND_WORDS.failed}</p>
    {/if}
  {/if}
</dialog>

<style>
  .yourturn {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: min(36rem, 100%);
    /* The view (the body) already ends above the bar at the bottom; the top leaves room for the feed's top bar. */
    height: 100%;
    margin: 0 auto;
    padding: 5rem 1rem 1rem;
    box-sizing: border-box;
  }
  .empty {
    display: grid;
    flex: 1;
    place-content: center;
    justify-items: center;
    gap: 1rem;
    text-align: center;
  }
  .empty p {
    max-width: 22rem;
    margin: 0;
  }
  .list {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-width: none;
    list-style: none;
  }
  .list::-webkit-scrollbar {
    display: none;
  }
  li {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    column-gap: 0.75rem;
  }
  .sentgame {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
    margin: 0;
    color: inherit;
    text-decoration: none;
  }
  .sentgame img,
  .still {
    flex: none;
    width: 64px;
    height: 64px;
    border-radius: var(--radius-button);
    object-fit: cover;
    background: var(--felt-deep);
  }
  .words {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .words > * {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .when {
    font: var(--text-small);
  }
  form {
    margin: 0;
  }
  .remove {
    margin: 0;
  }
  /* The → button under the sender: smaller words, still a full target to press, lined up with the words. */
  .stop {
    grid-column: 1;
    justify-self: start;
    min-height: var(--size-target);
    margin: 0 0 0 calc(64px + 0.75rem);
    padding: 0;
    border: 0;
    background: none;
    box-shadow: none;
    font-size: 0.875rem;
  }
  .problem {
    grid-column: 1 / -1;
    margin: 0;
  }
  .more {
    margin: 0;
  }
  .stopcard {
    width: min(24rem, calc(100vw - 2rem));
    padding: 1.5rem;
    border: 0;
    border-radius: var(--radius-card);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    text-shadow: var(--glass-ink);
  }
  .stopcard h2 {
    margin: 0 0 1rem;
    font: var(--text-statement);
  }
  .stopcard form,
  .stopcard form button,
  .stopcard > button {
    width: 100%;
  }
  .stopcard > button {
    margin-top: 0.5rem;
  }
</style>
