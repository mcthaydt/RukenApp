<!--
  A game laid out as members will see it (spec 5b): its two videos side by side in their real shapes, its name as a
  title and its line as a tagline, and the facts as quiet chips. A small Change sits beside each part that may be
  changed here; it opens that one question, which comes straight back. File sizes and counts are not shown: they are
  not for a maker to weigh up here.
-->
<script lang="ts">
  import type { ChangePart, LaidOutGame } from "../laid-out.ts";
  import VideoTile from "./VideoTile.svelte";

  let { game }: { game: LaidOutGame } = $props();

  /** What each Change says to a reader that hears it out of its place. It always starts with the visible word. */
  const CHANGE_WORDS: Record<ChangePart, string> = {
    name: "Change the name",
    one_line: "Change the line",
    files: "Change the game's files",
    plays_on: "Change where it plays",
    upright_video: "Change the upright video",
    wide_video: "Change the wide video",
    age_rating: "Change who it's for",
    other_websites: "Change the other websites",
  };

  const CLIPS = [
    { shape: "upright", words: "On phones", part: "upright_video" },
    { shape: "wide", words: "On computers", part: "wide_video" },
  ] as const;
</script>

{#snippet change(part: ChangePart)}
  {#if game.changes[part] !== undefined}
    <a class="change" href={game.changes[part]} aria-label={CHANGE_WORDS[part]}>Change</a>
  {/if}
{/snippet}

<div class="laid">
  <div class="tiles">
    {#each CLIPS as clip (clip.shape)}
      <figure>
        <div data-shape={clip.shape}>
          <VideoTile src={clip.shape === "upright" ? game.upright : game.wide} shape={clip.shape} />
        </div>
        <figcaption><span>{clip.words}</span> {@render change(clip.part)}</figcaption>
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
      <li><span class="chip">{chip.words}</span>{@render change(chip.part)}</li>
    {/each}
  </ul>
</div>
