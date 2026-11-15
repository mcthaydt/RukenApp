<!--
  A question answered in one box: the paper slab, the hint under it, and the refusal under the hint. The box is named
  by the question's own heading, so a reader hears the question when it lands on the box. A refused box is marked, and
  keeps what was typed. An answer of several lines (the websites, one to a line) is a taller box of the same kind.
-->
<script lang="ts">
  import { previewOfPage } from "./preview.svelte.ts";

  let {
    name,
    value,
    hint,
    problem,
    lines,
    previews,
  }: {
    name: string;
    value: string;
    hint: string;
    problem: string | undefined;
    /** How many lines tall the box is, for an answer of several lines; a one-line answer leaves it out. */
    lines?: number | undefined;
    /** The part of the card beside the question that this box fills in as it is typed: the name, or the one line. */
    previews?: "name" | "line" | undefined;
  } = $props();

  const preview = previewOfPage();

  function typed(event: Event): void {
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    if (previews === "name") preview?.typeName(event.currentTarget.value);
    if (previews === "line") preview?.typeLine(event.currentTarget.value);
  }
</script>

{#if lines === undefined}
  <input
    class="answer"
    type="text"
    {name}
    {value}
    oninput={typed}
    autocomplete="off"
    aria-labelledby="question"
    aria-describedby={problem === undefined ? "hint" : "hint problem"}
    aria-invalid={problem === undefined ? undefined : "true"}
  />
{:else}
  <textarea
    class="answer"
    {name}
    {value}
    rows={lines}
    autocomplete="off"
    aria-labelledby="question"
    aria-describedby={problem === undefined ? "hint" : "hint problem"}
    aria-invalid={problem === undefined ? undefined : "true"}></textarea>
{/if}
<p class="note" id="hint">{hint}</p>
{#if problem !== undefined}
  <p class="problem" id="problem" role="alert">{problem}</p>
{/if}
