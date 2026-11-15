<!--
  A question answered in one box: the paper slab, the hint under it, and the refusal under the hint. The box is named
  by the question's own heading, so a reader hears the question when it lands on the box. A refused box is marked, and
  keeps what was typed.
-->
<script lang="ts">
  let {
    name,
    value,
    hint,
    problem,
  }: {
    name: string;
    value: string;
    hint: string;
    problem: string | undefined;
  } = $props();
</script>

<input
  class="answer"
  type="text"
  {name}
  {value}
  autocomplete="off"
  aria-labelledby="question"
  aria-describedby={problem === undefined ? "hint" : "hint problem"}
  aria-invalid={problem === undefined ? undefined : "true"}
/>
<p class="note" id="hint">{hint}</p>
{#if problem !== undefined}
  <p class="problem" id="problem" role="alert">{problem}</p>
{/if}
