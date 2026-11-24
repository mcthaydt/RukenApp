<!--
  The Report sheet (report-a-game spec): a glass panel over a dimmed screen where a player says what is wrong with a
  game. One sheet serves a whole screen: the screen calls `open` with the game and the button that was pressed. It asks
  the site what this person has already sent, then shows the reasons, a box for their own words and one main button.
  A report they already sent is shown back to them, to change or to take back. Someone signed out is asked to sign in,
  and a maker is told they can't report their own game. It needs script, so the buttons that open it only show with it.
-->
<script lang="ts">
  import Icon from "../../lib/icon.svelte";
  import { NOTE_MAX, REASON_WORDS, REPORT_REASONS, type ReportReason } from "./reasons.ts";

  type Phase = "loading" | "failed" | "signed-out" | "own" | "form" | "thanks" | "gone";

  let sheet = $state<HTMLDialogElement>();
  let game = $state<{ slug: string; name: string } | null>(null);
  let opener: HTMLElement | null = null;
  let phase = $state<Phase>("loading");
  let signIn = $state("/sign-in");
  // Whether this person already has a report on this game, so the main button says "Save changes".
  let reported = $state(false);
  let reason = $state<ReportReason | null>(null);
  let note = $state("");
  let sending = $state<"save" | "withdraw" | null>(null);
  let problem = $state("");

  const address = () => `/g/${game?.slug ?? ""}/report`;

  /** Opens the sheet for a game. Focus goes back to `from` when it closes. */
  export function open(which: { slug: string; name: string }, from: HTMLElement | null): void {
    game = which;
    opener = from;
    phase = "loading";
    problem = "";
    reason = null;
    note = "";
    reported = false;
    sheet?.showModal();
    void load();
  }

  async function load(): Promise<void> {
    try {
      const answer = await fetch(address(), { headers: { accept: "application/json" } });
      if (!answer.ok) throw new Error(`the site answered ${String(answer.status)}`);
      const view = await answer.json<
        | { state: "signed-out"; signIn: string }
        | { state: "own" }
        | { state: "none" }
        | { state: "reported"; reason: ReportReason; note: string }
      >();
      if (view.state === "signed-out") {
        signIn = view.signIn;
        phase = "signed-out";
      } else if (view.state === "own") phase = "own";
      else {
        reported = view.state === "reported";
        if (view.state === "reported") {
          reason = view.reason;
          note = view.note;
        }
        phase = "form";
      }
    } catch {
      phase = "failed";
    }
  }

  async function send(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (sending !== null) return;
    if (reason === null) {
      problem = "Pick what's wrong.";
      return;
    }
    sending = "save";
    problem = "";
    try {
      const answer = await fetch(address(), {
        method: "PUT",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ reason, note }),
      });
      if (answer.ok) phase = "thanks";
      else problem = await problemOf(answer);
    } catch {
      problem = "That didn't work. Try again.";
    } finally {
      sending = null;
    }
  }

  async function withdraw(): Promise<void> {
    if (sending !== null) return;
    sending = "withdraw";
    problem = "";
    try {
      const answer = await fetch(address(), { method: "DELETE", headers: { accept: "application/json" } });
      if (answer.ok) phase = "gone";
      else problem = await problemOf(answer);
    } catch {
      problem = "That didn't work. Try again.";
    } finally {
      sending = null;
    }
  }

  /** The site's own words for a refusal (too many, your own game), or the plain fallback. */
  async function problemOf(answer: Response): Promise<string> {
    try {
      const said = await answer.json<{ problem?: unknown }>();
      if (typeof said.problem === "string" && answer.status !== 500) return said.problem;
    } catch {
      // Not JSON: say the plain thing below.
    }
    return "That didn't work. Try again.";
  }

  function close(): void {
    sheet?.close();
  }
</script>

<dialog
  class="reportsheet"
  bind:this={sheet}
  aria-labelledby="report-title"
  onclose={() => {
    opener?.focus();
  }}
>
  <div class="inside" aria-busy={phase === "loading" ? "true" : "false"}>
    <div class="top">
      <h2 id="report-title">Report this game</h2>
      <button type="button" class="close" aria-label="Close" onclick={close}><Icon name="close" /></button>
    </div>
    {#if game !== null}
      <p class="which">{game.name}</p>
    {/if}

    {#if phase === "loading"}
      <span class="spinner" role="progressbar" aria-label="Loading your report"></span>
    {:else if phase === "failed"}
      <p role="alert">That didn't work. Try again.</p>
      <button type="button" class="main" onclick={() => void load()}>Try again</button>
    {:else if phase === "signed-out"}
      <p>Sign in to report a game.</p>
      <a class="button main" href={signIn}>Sign in</a>
    {:else if phase === "own"}
      <p>This is your game, so you can't report it.</p>
      <button type="button" class="main" onclick={close}>Done</button>
    {:else if phase === "thanks"}
      <p role="status">Thanks. We'll take a look.</p>
      <button type="button" class="main" onclick={close}>Done</button>
    {:else if phase === "gone"}
      <p role="status">Your report is gone.</p>
      <button type="button" class="main" onclick={close}>Done</button>
    {:else}
      <form onsubmit={send}>
        {#if reported}
          <p class="already">You reported this game.</p>
        {/if}
        <fieldset>
          <legend>What's wrong?</legend>
          {#each REPORT_REASONS as one (one)}
            <label class="reason">
              <input type="radio" name="reason" value={one} bind:group={reason} />
              <span>{REASON_WORDS[one]}</span>
            </label>
          {/each}
        </fieldset>
        <label class="more">
          <span>Tell us more (you don't have to)</span>
          <textarea name="note" rows="3" maxlength={NOTE_MAX} bind:value={note}></textarea>
        </label>
        {#if problem !== ""}
          <p class="problem" role="alert">{problem}</p>
        {/if}
        <!-- Not `disabled` while it sends: a disabled button drops the keyboard's focus; a second press is refused above. -->
        <button
          class="main"
          aria-disabled={sending !== null ? "true" : undefined}
          aria-busy={sending === "save" ? "true" : undefined}
        >
          {#if sending === "save"}
            Sending…
          {:else}
            {reported ? "Save changes" : "Send report"}
          {/if}
        </button>
        {#if reported}
          <button
            type="button"
            class="quiet"
            aria-disabled={sending !== null ? "true" : undefined}
            aria-busy={sending === "withdraw" ? "true" : undefined}
            onclick={() => void withdraw()}
          >
            {sending === "withdraw" ? "Taking it back…" : "Take back my report"}
          </button>
        {/if}
      </form>
    {/if}
  </div>
</dialog>

<style>
  /* The screen behind is dimmed and blurred; the panel is glass over it. On an upright phone it rises from the bottom,
     elsewhere it sits in the middle. It is never taller than the window: what does not fit scrolls inside it. */
  .reportsheet {
    width: min(28rem, calc(100vw - 2rem));
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
  .reportsheet::backdrop {
    background: var(--dim-bg);
    -webkit-backdrop-filter: var(--dim-filter);
    backdrop-filter: var(--dim-filter);
  }
  .inside {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    max-height: calc(100dvh - 2rem);
    padding: 1.25rem;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }
  h2 {
    margin: 0;
    font: var(--text-statement);
  }
  p {
    margin: 0;
    font: var(--text-body);
  }
  .which {
    margin-top: -0.5rem;
    color: var(--sage);
  }
  .already {
    font-weight: 600;
  }
  .close {
    flex: none;
    padding: 0;
    width: var(--size-target);
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  fieldset {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin: 0;
    padding: 0;
    border: 0;
  }
  legend {
    margin-bottom: 0.375rem;
    padding: 0;
    font: var(--text-button);
  }
  .reason {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: var(--size-target);
    padding: 0 1rem;
    border-radius: var(--radius-button);
    box-shadow: var(--glass-edge);
    font: var(--text-button);
    cursor: pointer;
  }
  .reason:has(input:checked) {
    background: var(--glass-lift);
  }
  .reason input {
    flex: none;
    width: 1.25rem;
    height: 1.25rem;
    margin: 0;
    accent-color: var(--pay);
  }
  .more {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font: var(--text-button);
  }
  textarea {
    resize: none;
    text-shadow: none;
  }
  .problem {
    font-weight: 600;
    color: var(--pay-light);
  }
  .main {
    width: 100%;
    background: var(--glass-pay);
    box-shadow: var(--glass-edge);
  }
  .quiet {
    justify-content: center;
    width: 100%;
    background: var(--glass-safe);
    box-shadow: var(--glass-edge);
  }
  .spinner {
    align-self: center;
    width: 2rem;
    height: 2rem;
    margin: 1rem;
  }
  @media (orientation: portrait) and (max-width: 47.99rem) {
    .reportsheet {
      width: 100vw;
      margin: auto 0 0;
      border-radius: var(--radius-card) var(--radius-card) 0 0;
    }
    .inside {
      padding-bottom: calc(1.25rem + env(safe-area-inset-bottom, 0px));
    }
  }
</style>
