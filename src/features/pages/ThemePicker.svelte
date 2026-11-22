<!--
  The colours question (spec 5.5, I6): Ruken's own colours and one tile for each offered combination. A tile is a real
  radio button laid over the whole tile, in that combination's own ground, with "Aa" in its text colour and a bar in its
  button's colours, so a maker sees the page before choosing it. Nothing is chosen for the maker beyond what the page
  wears now. Each tile is at least 48px tall.
-->
<script lang="ts">
  import { DEFAULT_THEME, type Theme } from "./themes.ts";

  interface Swatch {
    id: number;
    ground: string;
    text: string;
    button: string;
    buttonText: string;
  }

  let {
    themes,
    chosen,
    problem,
  }: {
    themes: readonly Swatch[];
    /** The number of the colours the page wears now: 0 for Ruken's own. */
    chosen: number;
    problem: string | undefined;
  } = $props();

  const own: Theme = DEFAULT_THEME;
  const swatches = $derived<Swatch[]>([own, ...themes]);

  const nameOf = (id: number): string => (id === 0 ? "Ruken's own colours" : `Colours ${String(id)}`);
</script>

<fieldset
  class="themes"
  aria-labelledby="question"
  aria-describedby={problem === undefined ? "hint" : "hint problem"}
>
  {#each swatches as swatch (swatch.id)}
    <label
      class="swatch"
      style:--ground={swatch.ground}
      style:--text={swatch.text}
      style:--button={swatch.button}
      style:--button-text={swatch.buttonText}
    >
      <input
        type="radio"
        name="theme"
        value={swatch.id}
        defaultChecked={swatch.id === chosen}
        aria-label={nameOf(swatch.id)}
      />
      <span class="aa" aria-hidden="true">Aa</span>
      <span class="bar" aria-hidden="true"></span>
      <span class="name" aria-hidden="true">{nameOf(swatch.id)}</span>
    </label>
  {/each}
</fieldset>

<style>
  .themes {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
    gap: 0.75rem;
    border: 0;
    min-inline-size: 0;
  }

  .swatch {
    position: relative;
    display: grid;
    gap: 0.375rem;
    min-height: 3rem;
    padding: 0.75rem;
    border-radius: 0.75rem;
    background: var(--ground);
    color: var(--text);
    /* A tile is told from the felt by an edge, so a combination whose ground is the felt's own colour still shows. */
    outline: 2px solid var(--sage);
    outline-offset: -2px;
    cursor: pointer;
  }

  .swatch input {
    position: absolute;
    inset: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .swatch:has(input:checked) {
    outline: 4px solid var(--paper);
    outline-offset: 2px;
  }

  .swatch:has(input:focus-visible) {
    outline: 4px dashed var(--paper);
    outline-offset: 4px;
  }

  .aa {
    font: var(--text-statement);
  }

  .bar {
    display: block;
    height: 1.5rem;
    border-radius: 0.5rem;
    background: var(--button);
    box-shadow: inset 0 0 0 0.5rem var(--button);
  }

  .name {
    font: var(--text-small);
  }
</style>
