<!--
  A question answered in one box: the paper slab, the hint under it, and the refusal under the hint. The box is named
  by the question's own heading, so a reader hears the question when it lands on the box. A refused box is marked, and
  keeps what was typed. An answer of several lines (the websites, one to a line) is a taller box of the same kind. A
  one-line answer that can run long (the line about the game) is a box that grows with its words, so a phone shows all of
  what was typed and not its tail; Enter still goes on, as in a one-line box, and the answer has no new line in it.
-->
<script lang="ts">
  import { previewOfPage } from "./preview.svelte.ts";

  let {
    name,
    value,
    hint,
    problem,
    lines,
    grows,
    previews,
  }: {
    name: string;
    value: string;
    hint: string;
    problem: string | undefined;
    /** How many lines tall the box is, for an answer of several lines; a one-line answer leaves it out. */
    lines?: number | undefined;
    /** True for a one-line answer that is a box growing with its words, so none of it is out of sight. */
    grows?: boolean | undefined;
    /** The part of the card beside the question that this box fills in as it is typed: the name, or the one line. */
    previews?: "name" | "line" | undefined;
  } = $props();

  const preview = previewOfPage();

  // A refusal is about what was sent. Once the box is changed it is about nothing, so it goes; the answer that comes
  // back next (different words, or a different refusal) is a new thing and shows.
  const sent = $derived(`${value}\n${problem ?? ""}`);
  let editedFrom = $state<string | undefined>(undefined);
  const shown = $derived(editedFrom === sent ? undefined : problem);

  function typed(event: Event): void {
    editedFrom = sent;
    const box = event.currentTarget;
    if (!(box instanceof HTMLInputElement || box instanceof HTMLTextAreaElement)) return;
    if (previews === "name") preview?.typeName(box.value);
    if (previews === "line") preview?.typeLine(box.value);
  }

  /** Enter in a growing one-line box goes on, as Enter does in a one-line box; Shift and a composing keyboard are left alone. */
  function enterGoesOn(event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    if (event.currentTarget instanceof HTMLTextAreaElement) event.currentTarget.form?.requestSubmit();
  }
</script>

{#if lines === undefined && grows !== true}
  <input
    class="answer"
    type="text"
    {name}
    {value}
    oninput={typed}
    autocomplete="off"
    aria-labelledby="question"
    aria-describedby={shown === undefined ? "hint" : "hint problem"}
    aria-invalid={shown === undefined ? undefined : "true"}
  />
{:else}
  <textarea
    class="answer"
    {name}
    {value}
    rows={lines ?? 1}
    data-grows={lines === undefined ? "" : undefined}
    oninput={typed}
    onkeydown={lines === undefined ? enterGoesOn : undefined}
    autocomplete="off"
    aria-labelledby="question"
    aria-describedby={shown === undefined ? "hint" : "hint problem"}
    aria-invalid={shown === undefined ? undefined : "true"}></textarea>
{/if}
<p class="note" id="hint">{hint}</p>
{#if shown !== undefined}
  <p class="problem" id="problem" role="alert">{shown}</p>
{/if}
