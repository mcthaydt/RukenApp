<!--
  The other websites a game talks to: one line for each, with a Remove button beside it and "Add another website" under
  them. There is always at least one empty line to type in, and a line left empty is not a website (the server ignores
  it). Five at most, as the checker allows. A refusal goes away once a line is changed, as in TextAnswer.
-->
<script lang="ts">
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
  const start = () => {
    const typed = value.split("\n").filter((text) => text.trim() !== "");
    return (typed.length === 0 ? [""] : typed).map(lineOf);
  };
  let lines = $state(start());

  const sent = $derived(`${value}\n${problem ?? ""}`);
  let editedFrom = $state<string | undefined>(undefined);
  const shown = $derived(editedFrom === sent ? undefined : problem);

  function add(): void {
    editedFrom = sent;
    lines.push(lineOf(""));
  }

  function remove(id: number): void {
    editedFrom = sent;
    lines = lines.filter((line) => line.id !== id);
    if (lines.length === 0) lines.push(lineOf(""));
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
        class="remove"
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
    <button type="button" class="add" onclick={add}>Add another website</button>
  {/if}
</div>
<p class="note" id="hint">{hint}</p>
{#if shown !== undefined}
  <p class="problem" id="problem" role="alert">{shown}</p>
{/if}

<style>
  .lines {
    display: grid;
    gap: 0.75rem;
  }
  .line {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }
  .line .answer {
    flex: 1;
    min-width: 0;
  }
  .remove,
  .add {
    font: inherit;
    min-height: 2.75rem;
    padding: 0 1rem;
    cursor: pointer;
  }
</style>
