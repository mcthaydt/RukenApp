<!--
  A game's page (spec 3, the Bento page): one grid of tiles. The clip with the name and the one line over it, a tile
  for Play and what it costs with Share and Report, one each for the age and where it plays, the two clips to pick from, who made
  it, and more from the maker. Everything a person needs before pressing Play is a plain sentence. It reads without script: the upright clip shows with its own controls and Play is a link. With
  script the clip box takes the window's shape, the two tiles switch clips, pressing the clip opens it full size with
  sound, and a coarse pointer makes "computer" read "tablet".
-->
<script lang="ts">
  import Icon from "../../../lib/icon.svelte";
  import { gameTitle } from "../../../lib/titles.ts";
  import { loads } from "../../../lib/loads.ts";
  import { stillPoster } from "../../../lib/still-poster.ts";
  import { onMount } from "svelte";
  import { quietVideo } from "../../../lib/quiet-video.ts";
  import { WishlistButton } from "../../../features/launch/launch.browser.ts";
  import { ReportSheet, type ReportSheetControl } from "../../../features/moderation/moderation.browser.ts";
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
  let reportSheet = $state<ReportSheetControl>();

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
  <title>{gameTitle(data.name)}</title>
</svelte:head>

<main class="gamepage">
  <div class="bento">
    <div class="cell hero">
      <div class="clipbox" data-shape={shape}>
        {#key shape}
          <video
            use:loads
            use:stillPoster
            src={`${data.clips[shape]}#t=0.001`}
            preload="metadata"
            tabindex={enhanced ? -1 : undefined}
            controls={!enhanced}
            muted
            playsinline
            use:quietVideo
          ></video>
        {/key}
        {#if enhanced}
          <button
            type="button"
            class="clipopen"
            onclick={watchFullSize}
            aria-label="Watch the video full size"
          >
          </button>
        {/if}
      </div>
      <a class="back" href="/" aria-label="Back to the feed"><Icon name="back" /></a>
      <div class="heroname">
        <h1>{data.name}</h1>
        <p>{data.oneLine}</p>
      </div>
    </div>

    <div class="side">
      <div class="card cell playtile">
        {#if data.launch.before}
          <WishlistButton
            slug={data.slug}
            wished={data.launch.wished.includes(data.slug)}
            opens={data.launch.opens}
            back={`/g/${data.slug}`}
            buttonClass="button"
          />
        {:else}
          <a class="button" href={`/g/${data.slug}/play`}>Play</a>
        {/if}
        <div class="costrow">
          {#if data.cost === "join"}
            <p class="costline">
              Members play every game. {data.price} a month.&nbsp;<a class="joinlink" href={joinAt}>Join</a>
            </p>
            <p class="costline">Tax is added where it applies.</p>
          {:else}
            <p class="costline">{COST_WORDS[data.cost]}</p>
          {/if}
        </div>
        <div class="ways">
          <button type="button" class="outline" onclick={share}>Share</button>
          {#if enhanced}
            <button
              type="button"
              class="outline"
              onclick={(event) => {
                reportSheet?.open({ slug: data.slug, name: data.name }, event.currentTarget);
              }}>Report</button
            >
          {/if}
        </div>
        {#if sharedNote !== ""}
          <p class="note" role="status">{sharedNote}</p>
        {/if}
      </div>

      <div class="card cell fact">
        <p class="note">Age</p>
        <p><span class="chip">{data.rating.chip}</span></p>
        <p class="note">{data.rating.line}</p>
      </div>

      <div class="card cell fact">
        <p class="note">Where it plays</p>
        <p>Plays on this {device}. Nothing to install.</p>
      </div>

      {#if data.sitting !== null}
        <div class="card cell fact">
          <p class="note">Play time</p>
          <p>Most people play {data.sitting} at a time.</p>
        </div>
      {/if}

      {#if data.players !== null}
        <div class="card cell fact">
          <p class="note">Players</p>
          <p>{data.players}</p>
        </div>
      {/if}

      {#if enhanced}
        <div class="card cell watch">
          <p class="note">Watch it two ways</p>
          <div class="pickers">
            <button
              type="button"
              aria-pressed={shape === "upright"}
              onclick={() => (picked = "upright")}
              aria-label="Watch the upright video"
            >
              <video
                use:loads
                use:stillPoster
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
                use:loads
                use:stillPoster
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
        </div>
      {/if}

      {#if data.maker !== null}
        <div class="card cell madeby">
          {#if data.maker.photo !== null}
            <img use:loads src={data.maker.photo} alt="" width="48" height="48" />
          {/if}
          <span
            >Made by <a data-sveltekit-preload-data="off" href={`/${data.maker.handle}`}
              ><strong>{data.maker.name}</strong></a
            >{#if data.maker.oneLine !== ""}
              <q>{data.maker.oneLine}</q>{/if}</span
          >
        </div>
      {/if}
    </div>

    {#if data.maker !== null && data.more.length > 0}
      <section class="card cell more" data-solo={data.more.length === 1 ? "" : undefined}>
        <h2>More from {data.maker.name}</h2>
        <ul>
          {#each data.more as game (game.slug)}
            <li>
              <a href={`/g/${game.slug}`}>
                <video
                  use:loads
                  use:stillPoster
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
  </div>
</main>

<dialog class="viewer" bind:this={viewer} onclose={() => (opened = false)}>
  {#if opened}
    <!-- A game's videos are silent, so there is nothing to caption. -->
    <!-- svelte-ignore a11y_media_has_caption -->
    <video use:loads use:stillPoster src={data.clips[shape]} controls autoplay playsinline></video>
  {/if}
  <button type="button" class="safe" onclick={() => viewer?.close()} aria-label="Close"
    ><Icon name="close" /></button
  >
</dialog>

<ReportSheet bind:this={reportSheet} />
