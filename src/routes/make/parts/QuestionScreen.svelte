<!--
  One question on the felt: the counter and the track over it, the question as the heading, the answer (the page's own
  boxes or choices), and the buttons. Each question is a plain page and form that works before its script wakes; with
  script, a press says it is saving and cannot be pressed twice, and a refusal puts the keyboard on the box it is about.
  The first time through the blue button says Next and the counter shows; changing an answer later says Save and shows
  neither (spec 3 and 4). A question whose answer takes a while (copying a game) says what it is doing while it waits,
  and a question whose forward step is not a form post (connecting GitHub, choosing a video) brings its own blue button.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { tick, type Snippet } from "svelte";
  import { focusFirstRefused } from "../../../lib/focus.ts";

  let {
    heading,
    counter,
    back,
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
    /** The address that throws the game away; none before a game exists. */
    throwAway?: string;
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
  <title>Your game · Ruken</title>
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

<main>
  <form
    method="POST"
    use:enhance={({ cancel }) => {
      // A second press while the first is out would save twice, and for a new game make two.
      if (saving) cancel();
      saving = true;
      return async ({ update }) => {
        await update();
        saving = false;
        await tick();
        focusFirstRefused();
      };
    }}
  >
    {#if counter !== null}
      <p class="count">Question {counter.n} of {counter.of}</p>
    {/if}
    <h1 id="question">{heading}</h1>
    {@render children()}
    {#if saving && busyLine !== undefined}
      <p class="note" role="status">{busyLine}</p>
    {/if}
    <div class="acts">
      <a class="button safe" href={back}>Back</a>
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

{#if throwAway !== undefined}
  <a class="foot" href={throwAway}>Throw this game away</a>
{/if}
