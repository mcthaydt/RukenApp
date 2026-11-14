<!--
  One of a game's two videos: its title, where it stands, and Ruken's own picker (not the browser's "Choose File"). The
  real file field stays in the page, hidden from sight only, so the keyboard reaches it and a reader reads it; the
  words over it are a button of the look. Choosing a file adds it at once: the browser checks the kind and size first
  (the server checks again), and a refusal is in plain words under the video's line, with the file's name and size so
  the maker can see which file was refused. Without script, an "Add this video" button sends the form instead.
  Only the first video still missing is filled; the rest are quiet, so there is one obvious next press.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import { sizeWords } from "../../../lib/size-words.ts";
  import { videoChoiceProblem } from "../../../lib/video-choice.ts";

  let {
    shape,
    title,
    hint,
    bytes,
    canChange,
    live = false,
    quiet,
    refusal,
    missing,
  }: {
    shape: "upright" | "wide";
    /** "Upright video" or "Wide video". */
    title: string;
    /** Which way round it goes and where it is shown. */
    hint: string;
    /** The size of the video that was added, measured when it was saved, or null when none was. */
    bytes: number | null;
    /** False once the game is live (its videos cannot change yet) or off Ruken: the row only says where it stands. */
    canChange: boolean;
    live?: boolean;
    /** True when another press is the one to make: the picker then looks like a link, not a filled button. */
    quiet: boolean;
    /** The server's refusal of the video that was sent, if any. */
    refusal: string | undefined;
    /** True when a refused send is waiting for this video. */
    missing: boolean;
  } = $props();

  // The file that was chosen last, shown by name and size (taken from the file itself, never typed), and what the
  // browser found wrong with it.
  let chosen = $state<{ name: string; size: number } | null>(null);
  let refusedHere = $state<string | null>(null);
  // True from the choice until the answer: a second send while one is out would add the video twice.
  let adding = $state(false);
  // False until the page's script has run; without script there is an "Add this video" button, and never two ways.
  let woke = $state(false);
  let field = $state<HTMLInputElement>();
  onMount(() => {
    woke = true;
    // A video chosen before the page's script had run is still in the field: take it now, since the "Add this video"
    // button goes away with the script and nothing else would send it.
    if (field !== undefined && (field.files?.length ?? 0) > 0) takeChoice(field);
  });

  const problem = $derived(adding ? null : (refusedHere ?? refusal ?? null));
  const label = $derived(bytes === null ? `Choose ${title.toLowerCase()}` : "Choose a different video");
  const describedBy = $derived(`${shape}-line${problem === null ? "" : ` ${shape}-problem`}`);

  /** Checks the video in the field and, when it is fine, adds it at once. */
  function takeChoice(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (file === undefined) return;
    chosen = { name: file.name, size: file.size };
    refusedHere = videoChoiceProblem(file);
    if (refusedHere !== null) {
      // Cleared, so the same file chosen again after a fix still counts as a choice.
      input.value = "";
      return;
    }
    input.form?.requestSubmit();
  }
</script>

<section class="step" aria-labelledby={`${shape}-title`}>
  <p><strong id={`${shape}-title`}>{title}</strong></p>
  <p id={`${shape}-line`}>
    {#if bytes !== null}
      {live ? "Added" : `Added · ${sizeWords(bytes)}`}
    {:else if canChange}
      <span class="note">{hint}</span>
    {:else}
      Not added
    {/if}
  </p>
  {#if chosen !== null}
    <p>{chosen.name} · {sizeWords(chosen.size)}</p>
  {/if}
  {#if adding}
    <p>Adding your video. Keep this page open.</p>
  {/if}
  {#if problem !== null}
    <p class="problem" id={`${shape}-problem`}>{problem}</p>
  {/if}
  {#if canChange}
    <form
      method="POST"
      action={`?/clip&shape=${shape}`}
      enctype="multipart/form-data"
      use:enhance={({ cancel }) => {
        if (adding) cancel();
        adding = true;
        return async ({ result, update }) => {
          await update();
          adding = false;
          // A video that was added shows as added; one that was refused stays named, so the maker sees which it was.
          if (result.type !== "failure") chosen = null;
        };
      }}
    >
      <label class="file" data-quiet={quiet ? "" : undefined}>
        <input
          type="file"
          name="clip"
          accept="video/mp4,video/webm"
          id={`${shape}-file`}
          disabled={adding}
          aria-busy={adding}
          aria-invalid={missing || problem !== null ? "true" : undefined}
          aria-describedby={describedBy}
          bind:this={field}
          onchange={(event) => {
            takeChoice(event.currentTarget);
          }}
        />
        <span>{adding ? "Adding your video…" : label}</span>
      </label>
      {#if !woke}
        <button class="quiet">Add this video</button>
      {/if}
    </form>
  {/if}
</section>
