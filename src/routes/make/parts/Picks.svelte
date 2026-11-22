<!--
  A question answered by choosing: paper cards, each a real radio button (pick one) or checkbox (pick several) laid
  over its whole card, so the whole card is the target. Nothing is chosen for the maker. On the 18+ marks, "None of
  these" stands alone: choosing it unticks the others and choosing another unticks it (the server does the same, for a
  maker without script).
-->
<script lang="ts">
  import { previewOfPage } from "./preview.svelte.ts";

  interface Option {
    value: string;
    title: string;
    line?: string;
  }

  let {
    name,
    options,
    chosen,
    several = false,
    ratings = false,
    plain = false,
    hint,
    problem,
    legend,
  }: {
    name: string;
    options: Option[];
    /** The values already chosen, when the answer is being changed. */
    chosen: readonly string[];
    several?: boolean;
    /** The five ratings sit in one row from a tablet up. */
    ratings?: boolean;
    /** The choices are names (a repository), set in the text face and broken only after a slash. */
    plain?: boolean;
    hint?: string;
    problem: string | undefined;
    /** Names the group when the heading is the name of another box on the same screen (a choice beside a typed answer). */
    legend?: string;
  } = $props();

  // The ids of the lines under the choices that a reader should hear with them.
  const describedBy = $derived(
    [hint === undefined ? "" : "hint", problem === undefined ? "" : "problem"].join(" ").trim() || undefined,
  );

  const preview = previewOfPage();

  function keepNoneAlone(event: Event): void {
    const picked = event.target;
    // The card beside the question shows the rating as it is chosen (its words are the choice's title).
    if (ratings && picked instanceof HTMLInputElement && picked.checked) {
      const words = options.find((option) => option.value === picked.value)?.title;
      if (words !== undefined) preview?.pickRating(words);
    }
    if (!several || !(picked instanceof HTMLInputElement) || !picked.checked) return;
    for (const box of picked.form?.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`) ?? []) {
      if (box !== picked && (picked.value === "none" || box.value === "none")) box.checked = false;
    }
  }
</script>

<fieldset
  class="picks"
  aria-labelledby={legend === undefined ? "question" : undefined}
  aria-label={legend}
  aria-describedby={describedBy}
  data-several={several ? "" : undefined}
  data-ratings={ratings ? "" : undefined}
  data-plain={plain ? "" : undefined}
  onchange={keepNoneAlone}
>
  <!-- `defaultChecked`, never `checked`: a set `checked` is written over a choice made before the page came alive,
       while a default one leaves it alone (as on the theme picker). -->
  {#each options as option, index (option.value)}
    <label class="pick">
      <input
        type={several ? "checkbox" : "radio"}
        {name}
        value={option.value}
        defaultChecked={chosen.includes(option.value)}
        aria-invalid={problem !== undefined && index === 0 ? "true" : undefined}
      />
      <b>
        {#if plain}
          <!-- A break may come after a slash and nowhere else, so "owner/name" is never cut in the middle of a word. -->
          {#each option.title.split("/") as part, index (index)}{index > 0 ? "/" : ""}{#if index > 0}<wbr
              />{/if}<span class="whole">{part}</span>{/each}
        {:else}
          {option.title}
        {/if}
      </b>
      {#if option.line !== undefined}
        <span>{option.line}</span>
      {/if}
    </label>
  {/each}
</fieldset>
{#if hint !== undefined}
  <p class="note" id="hint">{hint}</p>
{/if}
{#if problem !== undefined}
  <p class="problem" id="problem" role="alert">{problem}</p>
{/if}
