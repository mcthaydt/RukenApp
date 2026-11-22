<!--
  A question answered in one box: the paper slab, the hint under it, and the refusal under the hint. The box is named
  by the question's own heading, so a reader hears the question when it lands on the box. A refused box is marked, and
  keeps what was typed. An answer of several lines (the websites, one to a line) is a taller box of the same kind. A
  one-line answer that can run long (the line about the game) is a box that grows with its words, so a phone shows all of
  what was typed and not its tail; Enter still goes on, as in a one-line box, and the answer has no new line in it.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
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

  // Words a person selected in the box before the page came alive stay selected when it does, so what they type next
  // takes the selection's place. As the page comes alive Svelte puts the answer back into the box (a taller box is
  // emptied first), which leaves the cursor after the last word: typing then added to the saved answer instead of
  // replacing it (run 45033130832, and the one-line box in #332's review). This script runs before the box is brought to
  // life, so it reads the selection from the page as sent.
  let answerBox = $state<HTMLInputElement | HTMLTextAreaElement | undefined>(undefined);
  // Read once, on purpose: only the box as the page sent it matters, before it comes alive.
  const selectedBefore = untrack(() => selectionOfSentBox(name));

  function selectionOfSentBox(
    named: string,
  ): { value: string; start: number; end: number; direction: "forward" | "backward" | "none" } | undefined {
    if (typeof document === "undefined") return undefined;
    const sent = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      `input[name="${CSS.escape(named)}"], textarea[name="${CSS.escape(named)}"]`,
    );
    if (sent === null || sent !== document.activeElement) return undefined;
    const { selectionStart: start, selectionEnd: end, selectionDirection: direction } = sent;
    if (start === null || end === null) return undefined;
    return { value: sent.value, start, end, direction: direction ?? "none" };
  }

  // Put back once the box has come alive. A one-line box is put back a moment later than this, in a task Svelte queues
  // as the page comes alive (`remove_input_defaults`: it takes the `value` the server wrote off the box and sets the
  // words again, which moves the cursor to the end), so the selection goes back in the task after that one.
  onMount(() => {
    queueMicrotask(() => {
      if (selectedBefore === undefined || answerBox === undefined || answerBox.value !== selectedBefore.value)
        return;
      answerBox.setSelectionRange(selectedBefore.start, selectedBefore.end, selectedBefore.direction);
    });
  });

  // What the box holds: what came from the server, until it is typed over. Bound, never set, because a set value is
  // written over anything typed before the page came alive (run 44977261003), while a bound one keeps it. A new value
  // from the server (a refusal, a fresh question) is shown as before.
  let box = $derived(value);

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
    bind:this={answerBox}
    bind:value={box}
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
    bind:this={answerBox}
    bind:value={box}
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
