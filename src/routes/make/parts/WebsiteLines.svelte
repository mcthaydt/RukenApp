<!--
  The other websites a game talks to: one line for each, with a Remove button beside it and "Add another website" under
  them. There is always at least one empty line to type in, and a line left empty is not a website (the server ignores
  it). Five at most, as the checker allows. A refusal goes away once a line is changed, as in TextAnswer.
-->
<script lang="ts">
  import { tick } from "svelte";

  const MOST = 5;

  let {
    name,
    value,
    hint,
    problem,
  }: {
    name: string;
    /** The websites as saved or as sent back with a refusal, one to a line. */
    value: string;
    hint: string;
    problem: string | undefined;
  } = $props();

  // Each line has a number of its own, so removing one in the middle does not hand its words to the next.
  let nextId = 0;
  const lineOf = (text: string) => ({ id: nextId++, text });
  // The saved sites, then one empty box to type in (also for a maker without script, who cannot add one).
  const start = () => {
    const typed = value.split("\n").filter((text) => text.trim() !== "");
    return (typed.length < MOST ? [...typed, ""] : typed).map(lineOf);
  };
  let lines = $state(start());

  const sent = $derived(`${value}\n${problem ?? ""}`);
  let editedFrom = $state<string | undefined>(undefined);
  const shown = $derived(editedFrom === sent ? undefined : problem);

  let group = $state<HTMLElement | undefined>(undefined);

  /** Puts the keyboard in box number `index` once the page has drawn it, so a pressed button never drops it to the top. */
  async function focusBox(index: number): Promise<void> {
    await tick();
    group?.querySelectorAll<HTMLInputElement>("input")[index]?.focus();
  }

  function add(): void {
    editedFrom = sent;
    lines.push(lineOf(""));
    void focusBox(lines.length - 1);
  }

  function remove(id: number): void {
    editedFrom = sent;
    const at = lines.findIndex((line) => line.id === id);
    lines = lines.filter((line) => line.id !== id);
    if (lines.length === 0) lines.push(lineOf(""));
    void focusBox(Math.min(at, lines.length - 1));
  }
</script>

<div
  class="lines"
  role="group"
  aria-labelledby="question"
  aria-describedby={shown === undefined ? "hint" : "hint problem"}
>
  {#each lines as line, index (line.id)}
    <div class="line">
      <input
        class="answer"
        type="text"
        {name}
        bind:value={line.text}
        oninput={() => {
          editedFrom = sent;
        }}
        autocomplete="off"
        aria-label={`Website ${String(index + 1)}`}
        aria-invalid={shown === undefined ? undefined : "true"}
      />
      <button
        type="button"
        class="outline"
        onclick={() => {
          remove(line.id);
        }}
        aria-label={`Remove website ${String(index + 1)}`}
      >
        Remove
      </button>
    </div>
  {/each}
  {#if lines.length < MOST}
    <button type="button" class="outline" onclick={add}>Add another website</button>
  {/if}
</div>
<p class="note" id="hint">{hint}</p>
{#if shown !== undefined}
  <p class="problem" id="problem" role="alert">{shown}</p>
{/if}
