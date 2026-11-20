<!--
  A game's page (spec 3, the watch page): the clip at the top, then the name, the one line, who made it, Play and Share,
  and the facts together on one paper card, then more from the maker. Everything a person needs before pressing Play is
  a plain sentence. It reads without script: the upright clip shows with its own controls and Play is a link. With
  script the clip box takes the window's shape, the two tiles switch clips, pressing the clip opens it full size with
  sound, and a coarse pointer makes "computer" read "tablet".
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { quietVideo } from "../../../lib/quiet-video.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  // Whether the script has started: the clip's own controls and the plain Play link are what a page without script has.
  let enhanced = $state(false);
  // The clip showing: the window's shape until a tile is pressed.
  let windowShape = $state<"upright" | "wide">("upright");
  let picked = $state<"upright" | "wide" | null>(null);
  const shape = $derived(picked ?? windowShape);
  let tablet = $state(false);
  let viewer = $state<HTMLDialogElement>();
  let opened = $state(false);
  let sharedNote = $state("");

  const device = $derived(data.device === "computer" && tablet ? "tablet" : data.device);
  const joinAt = $derived(`/join?next=${encodeURIComponent(`/g/${data.slug}`)}`);

  const COST_WORDS = {
    own: "This is your game. Playing it here doesn't count toward its play time.",
    staff: "You can play this to check it. It doesn't count toward its play time.",
    free: "Free to play. No account needed.",
    member: "Included with your membership.",
  } as const;

  onMount(() => {
    enhanced = true;
    tablet = matchMedia("(pointer: coarse)").matches;
    const wide = matchMedia("(orientation: landscape)");
    windowShape = wide.matches ? "wide" : "upright";
    const follow = () => {
      windowShape = wide.matches ? "wide" : "upright";
    };
    wide.addEventListener("change", follow);
    return () => {
      wide.removeEventListener("change", follow);
    };
  });

  function watchFullSize(): void {
    opened = true;
    viewer?.showModal();
  }

  async function share(): Promise<void> {
    sharedNote = "";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: data.name, url: location.href });
        return;
      }
      await navigator.clipboard.writeText(location.href);
      sharedNote = "Link copied.";
    } catch (failure) {
      // A person closing the share sheet is an answer, not a failure.
      if (failure instanceof DOMException && failure.name === "AbortError") return;
      sharedNote = "Copy the address from the bar at the top.";
    }
  }
</script>

<svelte:head>
  <title>{data.name} · Ruken</title>
</svelte:head>

<main class="gamepage">
  <div class="stage">
    <div class="clipbox" data-shape={shape}>
      {#key shape}
        <video
          src={`${data.clips[shape]}#t=0.001`}
          preload="metadata"
          tabindex={enhanced ? -1 : undefined}
          controls={!enhanced}
          muted
          loop
          playsinline
          use:quietVideo
        ></video>
      {/key}
      {#if enhanced}
        <button type="button" class="clipopen" onclick={watchFullSize} aria-label="Watch the video full size">
        </button>
      {/if}
    </div>
    <a class="back" href="/">← Ruken</a>
    {#if enhanced}
      <div class="pickers">
        <button
          type="button"
          aria-pressed={shape === "upright"}
          onclick={() => (picked = "upright")}
          aria-label="Watch the upright video"
        >
          <video
            class="tile"
            src={`${data.clips.upright}#t=0.001`}
            preload="metadata"
            tabindex="-1"
            muted
            playsinline
            aria-hidden="true"
          ></video>
        </button>
        <button
          type="button"
          aria-pressed={shape === "wide"}
          onclick={() => (picked = "wide")}
          aria-label="Watch the wide video"
        >
          <video
            class="tile"
            src={`${data.clips.wide}#t=0.001`}
            preload="metadata"
            tabindex="-1"
            muted
            playsinline
            aria-hidden="true"
          ></video>
        </button>
      </div>
    {/if}
  </div>

  <div class="about">
    <h1>{data.name}</h1>
    <p class="statement">{data.oneLine}</p>

    {#if data.maker !== null}
      <p class="madeby">
        {#if data.maker.photo !== null}
          <img src={data.maker.photo} alt="" width="48" height="48" />
        {/if}
        <span
          >Made by <strong>{data.maker.name}</strong>{#if data.maker.oneLine !== ""}
            <q>{data.maker.oneLine}</q>{/if}</span
        >
      </p>
    {/if}

    <div class="playrow">
      <a class="button" href={`/g/${data.slug}/play`}>Play</a>
      <button type="button" class="outline" onclick={share}>Share</button>
    </div>
    {#if sharedNote !== ""}
      <p class="note" role="status">{sharedNote}</p>
    {/if}

    <div class="costrow">
      <div>
        {#if data.cost === "join"}
          <p class="costline">Members play every game. {data.price} a month.</p>
          <p class="costline">Tax is added where it applies.</p>
        {:else}
          <p class="costline">{COST_WORDS[data.cost]}</p>
        {/if}
      </div>
      {#if data.cost === "join"}
        <a class="button outline" href={joinAt}>Join</a>
      {/if}
    </div>

    <div class="facts">
      <p><span class="chip">{data.rating.chip}</span> {data.rating.line}</p>
      <p>Plays on this {device}. Nothing to install.</p>
      {#if data.sitting !== null}
        <p>Most people play {data.sitting} at a time.</p>
      {/if}
    </div>
  </div>

  {#if data.maker !== null && data.more.length > 0}
    <section class="more">
      <h2>More from {data.maker.name}</h2>
      <ul>
        {#each data.more as game (game.slug)}
          <li>
            <a href={`/g/${game.slug}`}>
              <video
                class="tile"
                src={`${game.wideClip}#t=0.001`}
                preload="metadata"
                tabindex="-1"
                muted
                playsinline
                aria-hidden="true"
              ></video>
              <span>{game.name}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</main>

<dialog class="viewer" bind:this={viewer} onclose={() => (opened = false)}>
  {#if opened}
    <!-- A game's videos are silent, so there is nothing to caption. -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <video src={data.clips[shape]} controls autoplay playsinline></video>
  {/if}
  <button type="button" class="safe" onclick={() => viewer?.close()}>Close</button>
</dialog>
