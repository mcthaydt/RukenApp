<!--
  A game laid out as members will see it (spec 5b): its two videos side by side in their real shapes, its name as a
  title and its line as a tagline, and the facts as quiet chips. A small Change sits beside each part that may be
  changed here; it opens that one question, which comes straight back. A part whose new value waits for staff's yes
  (a live game's video or rating) says so beside it. File sizes and counts are not shown: they are
  not for a maker to weigh up here. Live draws one of the two videos (`only`), the shape of the window it is seen on.
-->
<script lang="ts">
  import type { ChangePart, LaidOutGame } from "../laid-out.ts";
  import VideoTile from "./VideoTile.svelte";

  let { game, only }: { game: LaidOutGame; only?: "upright" | "wide" } = $props();

  /** What each Change says to a reader that hears it out of its place. It always starts with the visible word. */
  const CHANGE_WORDS: Record<ChangePart, string> = {
    name: "Change the name",
    one_line: "Change the line",
    files: "Change the game's files",
    upright_video: "Change the upright video",
    wide_video: "Change the wide video",
    age_rating: "Change who it's for",
    other_websites: "Change the other websites",
  };

  const ALL_CLIPS = [
    { shape: "upright", words: "On phones", part: "upright_video" },
    { shape: "wide", words: "On computers", part: "wide_video" },
  ] as const;
  const clips = $derived(only === undefined ? ALL_CLIPS : ALL_CLIPS.filter((clip) => clip.shape === only));
</script>

{#snippet change(part: ChangePart)}
  {#if game.changes[part] !== undefined}
    <a class="change" href={game.changes[part]} aria-label={CHANGE_WORDS[part]}>Change</a>
  {/if}
{/snippet}

{#snippet waiting(part: ChangePart)}
  {#if game.waiting.includes(part)}
    <span class="waits">Waiting for review</span>
  {/if}
{/snippet}

<div class="laid">
  <div class="tiles">
    {#each clips as clip (clip.shape)}
      <figure>
        <div data-shape={clip.shape}>
          <VideoTile src={clip.shape === "upright" ? game.upright : game.wide} shape={clip.shape} />
        </div>
        <!-- Live draws one video, so its caption has no words of its own: only what waits, and the Change. -->
        {#if only === undefined || game.waiting.includes(clip.part) || game.changes[clip.part] !== undefined}
          <figcaption>
            {#if only === undefined}<span>{clip.words}</span>{/if}
            {@render waiting(clip.part)}
            {@render change(clip.part)}
          </figcaption>
        {/if}
      </figure>
    {/each}
  </div>
  <div>
    <h2 class="title">{game.name}</h2>
    {@render change("name")}
  </div>
  <div>
    <p class="tagline">{game.line}</p>
    {@render change("one_line")}
  </div>
  <ul>
    {#each game.chips as chip (chip.part)}
      <li>
        <span class="chip">{chip.words}</span>
        {@render waiting(chip.part)}
        {@render change(chip.part)}
      </li>
    {/each}
    <!-- Live draws one video, so the one it does not draw is reached from here, as the other half of "its videos". -->
    {#each ALL_CLIPS.filter((clip) => only !== undefined && clip.shape !== only) as clip (clip.shape)}
      {#if game.changes[clip.part] !== undefined || game.waiting.includes(clip.part)}
        <li>
          <span>Video {clip.words.toLowerCase().replace("on ", "for ")}</span>
          {@render waiting(clip.part)}
          {@render change(clip.part)}
        </li>
      {/if}
    {/each}
  </ul>
</div>
