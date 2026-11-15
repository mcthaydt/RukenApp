<!--
  A question answered with a video (spec 5a notes 1 and 7, 5b): the video's frame is the biggest thing on the screen,
  there before any video is chosen, in its real shape. The blue button is Ruken's own picker over the real file field,
  so the keyboard reaches it; choosing a file adds it at once (the browser checks the kind and size first, the server
  checks again), and the blue button is then Next. Without script an "Add this video" button sends the form instead.
  "Choose a different video" opens the picker again with the video that is there still in its frame.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { sizeWords } from "../../../lib/size-words.ts";
  import { videoChoiceProblem } from "../../../lib/video-choice.ts";
  import QuestionScreen from "./QuestionScreen.svelte";
  import VideoTile from "./VideoTile.svelte";

  let {
    shape,
    video,
    counter,
    back,
    throwAway,
    problem,
  }: {
    shape: "upright" | "wide";
    /** Where the video stands: its address (none until one is in), and whether a different one is being chosen. */
    video: { src: string | null; replacing: boolean; replaceAddress: string; howToRecord: string };
    counter: { n: number; of: number } | null;
    back: string;
    throwAway: string | undefined;
    /** The server's refusal of the video that was sent, if any. */
    problem: string | undefined;
  } = $props();

  const words = $derived(
    shape === "upright"
      ? {
          heading: "Add your upright video",
          frame: "Taller than wide",
          note: "For phones: taller than wide. MP4, WebM or MOV, up to 30 MB.",
        }
      : {
          heading: "Add your wide video",
          frame: "Wider than tall",
          note: "For computers: wider than tall. MP4, WebM or MOV, up to 30 MB.",
        },
  );

  // True from the choice until the answer comes: a second send while one is out would add the video twice.
  let saving = $state(false);
  // The file chosen last, shown by name and size (taken from the file itself, never typed), and what the browser
  // found wrong with it.
  let chosen = $state<{ name: string; size: number } | null>(null);
  let refusedHere = $state<string | null>(null);
  // False until the page's script has run; without script there is an "Add this video" button, and never two ways.
  let woke = $state(false);
  let field = $state<HTMLInputElement>();
  let adder = $state<HTMLButtonElement>();

  /** True while the blue button is the picker: no video yet, or a different one is being chosen. */
  const choosing = $derived(video.src === null || video.replacing);
  const shown = $derived(saving ? null : (refusedHere ?? problem ?? null));

  // The refusal comes into view when it arrives: on a phone it would otherwise land under the pinned bar, and the maker
  // would see the button light up and nothing else change.
  let problemLine = $state<HTMLElement>();
  $effect(() => {
    if (shown !== null) problemLine?.scrollIntoView({ block: "nearest" });
  });

  onMount(() => {
    woke = true;
    // A video chosen before the page's script had run is still in the field: take it now, since the "Add this video"
    // button goes away with the script and nothing else would send it.
    if (field !== undefined && (field.files?.length ?? 0) > 0) takeChoice(field);
  });

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
    input.form?.requestSubmit(adder);
  }
</script>

<QuestionScreen
  heading={words.heading}
  {counter}
  {back}
  {throwAway}
  enterHint={!choosing}
  busyWords="Saving…"
  bind:saving
  forward={choosing ? picker : undefined}
>
  {#if video.src === null}
    <label class="vframe" data-frame={shape} for="clip-file"><span>{words.frame}</span></label>
  {:else}
    <div class="vframe" data-frame={shape}>
      <VideoTile src={video.src} {shape} />
    </div>
  {/if}
  <p class="note" id="hint">
    Record your screen while you play for 10 to 30 seconds. Players see it in the feed before they play.
  </p>
  <p class="note" id="note">{words.note}</p>
  <a href={video.howToRecord}>How do I record my screen?</a>
  {#if chosen !== null && choosing}
    <p>{chosen.name} · {sizeWords(chosen.size)}</p>
  {/if}
  {#if saving}
    <p class="note" role="status">Adding your video. Keep this page open.</p>
  {/if}
  {#if shown !== null}
    <p class="problem" id="problem" role="alert" bind:this={problemLine}>{shown}</p>
  {/if}
  {#if !choosing}
    <a href={video.replaceAddress}>Choose a different video</a>
  {/if}
</QuestionScreen>

{#snippet picker()}
  <label class="file">
    <input
      type="file"
      name="clip"
      id="clip-file"
      accept="video/mp4,video/webm,video/quicktime"
      disabled={saving}
      aria-busy={saving}
      aria-labelledby="clip-words"
      aria-describedby={shown === null ? "hint note" : "hint note problem"}
      aria-invalid={shown === null ? undefined : "true"}
      bind:this={field}
      onchange={(event) => {
        takeChoice(event.currentTarget);
      }}
    />
    <span id="clip-words">{saving ? "Adding your video…" : "Choose video"}</span>
  </label>
  <!-- The button without script. With script the field sends itself, and this one only says where to send it. -->
  <button hidden={woke} bind:this={adder} formaction="?/clip" formenctype="multipart/form-data">
    Add this video
  </button>
{/snippet}
