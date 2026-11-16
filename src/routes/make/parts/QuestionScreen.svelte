<!--
  One question on the felt: the counter and the track over it, the question as the heading, the answer (the page's own
  boxes or choices), and the buttons. Each question is a plain page and form that works before its script wakes; with
  script, a press says it is saving and cannot be pressed twice, and a refusal puts the keyboard on the box it is about.
  The first time through the blue button says Next and the counter shows; changing an answer later says Save and shows
  neither (spec 3 and 4). Staff's check of a game is asked the same way (one question at a time, the same buttons, the
  same track), so it takes a few extras: its own form address and tab title, no card beside it, a Back that steps
  inside the page, and a hook that turns a press of Next into a step instead of a send. A question whose answer takes a while (copying a game) says what it is doing while it waits,
  and a question whose forward step is not a form post (connecting GitHub, choosing a video) brings its own blue button.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { tick, type Snippet } from "svelte";
  import { focusFirstRefused, showTheRefusal } from "../../../lib/focus.ts";
  import GamePreview from "./GamePreview.svelte";

  /** A heading longer than this has a long name in it, and is set smaller (the stylesheet's `h1[data-long]`). */
  const LONG_HEADING = 50;

  let {
    heading,
    counter,
    back,
    onBack,
    action = "?/answer",
    title = "Your game",
    unit = "Question",
    card = true,
    beforeSend,
    throwAway,
    enterHint = true,
    busyWords = "Saving…",
    busyLine,
    forward,
    saving = $bindable(false),
    children,
  }: {
    heading: string;
    /** Where this question is among the game's questions, or null when an answer is being changed. */
    counter: { n: number; of: number } | null;
    /** Where Back goes: the question before, or the game, or Your games. */
    back: string;
    /** Back as a button, for a question that is one step of a page and not a page of its own. Then `back` is unused. */
    onBack?: (() => void) | undefined;
    /** The form's address: the maker saves an answer; staff decide. */
    action?: string;
    /** The tab's title, which does not say which game before it is known. */
    title?: string;
    /** What the counter calls a step ("Question 3 of 8"). */
    unit?: string;
    /** False where no card of the game sits beside the question (staff are not shown what players will see). */
    card?: boolean;
    /** Called as the form is sent; returning false stops the send (the press was only a step to the next question). */
    beforeSend?: (() => boolean) | undefined;
    /** The address that throws the game away; none before a game exists. */
    throwAway?: string | undefined;
    /** Enter presses the blue button, except where the blue button opens a file picker. */
    enterHint?: boolean;
    /** What the blue button says from the press until the answer comes. */
    busyWords?: string;
    /** A line shown under the answer while it waits, for an answer that can take a minute. */
    busyLine?: string;
    /** The blue button when it is not a submit: a link that goes elsewhere. */
    forward?: Snippet | undefined;
    /** True from the press until the answer comes; a question that shows it itself (a video being added) binds it. */
    saving?: boolean;
    children: Snippet;
  } = $props();
</script>

<svelte:head>
  <title>{title} · Ruken</title>
</svelte:head>

{#if counter !== null}
  <div class="track" aria-hidden="true">
    {#each Array.from({ length: counter.of }, (_, index) => index) as piece (piece)}
      <i
        data-on={piece < counter.n - 1 ? "" : undefined}
        data-newest={piece === counter.n - 2 ? "" : undefined}
      ></i>
    {/each}
  </div>
{/if}

<div class="asks" data-alone={card ? undefined : ""}>
  <main>
    <form
      method="POST"
      {action}
      use:enhance={({ cancel }) => {
        // A second press while the first is out would save twice, and for a new game make two.
        if (saving) cancel();
        // A press that only goes on to the next step sends nothing.
        if (beforeSend?.() === false) {
          cancel();
          return;
        }
        saving = true;
        return async ({ update }) => {
          await update();
          saving = false;
          await tick();
          focusFirstRefused();
          showTheRefusal();
        };
      }}
    >
      {#if counter !== null}
        <p class="count">{unit} {counter.n} of {counter.of}</p>
      {/if}
      <h1 id="question" data-long={heading.length > LONG_HEADING ? "" : undefined}>{heading}</h1>
      {@render children()}
      {#if saving && busyLine !== undefined}
        <p class="note" role="status">{busyLine}</p>
      {/if}
      <div class="acts">
        {#if onBack !== undefined}
          <button type="button" class="button safe" onclick={onBack}>Back</button>
        {:else}
          <a class="button safe" href={back}>Back</a>
        {/if}
        {#if forward !== undefined}
          {@render forward()}
        {:else}
          <button disabled={saving} aria-busy={saving ? "true" : undefined}>
            {saving ? busyWords : counter === null ? "Save" : "Next"}
          </button>
        {/if}
        {#if enterHint && forward === undefined}
          <span class="key">press Enter <kbd>↵</kbd></span>
        {/if}
      </div>
    </form>
  </main>
  {#if card}
    <GamePreview />
  {/if}
</div>

{#if throwAway !== undefined}
  <a class="foot" href={throwAway}>Throw this game away</a>
{/if}
