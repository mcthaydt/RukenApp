<!--
  A game that is live (spec 5c). Its own video fills the screen behind everything, blurred and dimmed, the upright one on
  an upright screen and the wide one on a wide screen; it moves only where a video may move by itself (quietVideo). In
  front: the line, the blue "See it on Ruken", a quiet outline "Send a new version" that copies the newest files and sends
  them for review in the one press, and the way back. Beside them the game laid out sharp, with a Change on its name, its
  line and where it plays only: its rating, files and videos go through staff again. An update that was sent back is a card.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import { quietVideo } from "../../../lib/quiet-video.ts";
  import type { FixCardData, LaidOutGame } from "../laid-out.ts";
  import FixCard from "./FixCard.svelte";
  import GameLaidOut from "./GameLaidOut.svelte";

  let {
    name,
    line,
    fixes,
    seeAddress,
    backdrop,
    game,
    problem,
  }: {
    name: string;
    line: string;
    fixes: FixCardData[];
    seeAddress: string;
    backdrop: { upright: string | null; wide: string | null };
    game: LaidOutGame;
    problem: string | undefined;
  } = $props();

  // True from the press until the answer comes: a second press while the first is out would send twice.
  let sending = $state(false);
  // The shape of this screen, known only in the browser; before then (and without script) the upright video stands in.
  let upright = $state(true);
  const src = $derived(upright ? (backdrop.upright ?? backdrop.wide) : (backdrop.wide ?? backdrop.upright));

  onMount(() => {
    const wide = matchMedia("(orientation: landscape)");
    upright = !wide.matches;
    const follow = () => {
      upright = !wide.matches;
    };
    wide.addEventListener("change", follow);
    return () => {
      wide.removeEventListener("change", follow);
    };
  });
</script>

<svelte:head>
  <title>Live · Ruken</title>
</svelte:head>

{#if src !== null}
  <div class="backdrop" aria-hidden="true">
    {#key src}
      <video {src} preload="metadata" muted loop playsinline use:quietVideo></video>
    {/key}
  </div>
{/if}

<main class="halves live">
  <div>
    <p class="count">{name}</p>
    <h1>Live</h1>
    <p>{line}</p>
    {#if problem !== undefined}
      <p class="problem" role="alert">{problem}</p>
    {/if}
    <div class="acts">
      <a class="button" href={seeAddress}>See it on Ruken</a>
    </div>
    <form
      method="POST"
      action="?/newVersion"
      use:enhance={({ cancel }) => {
        if (sending) cancel();
        sending = true;
        return async ({ update }) => {
          await update();
          sending = false;
        };
      }}
    >
      <button class="outline" disabled={sending} aria-busy={sending ? "true" : undefined}>
        {sending ? "Copying your game…" : "Send a new version"}
      </button>
      <p class="note">
        {sending
          ? "Copying your game can take a minute. Keep this page open."
          : "Copies the newest version of your game from GitHub and sends it for review. Your game stays live meanwhile."}
      </p>
    </form>
    <a class="foot" href="/make">Back to your games</a>
  </div>
  <div class="after">
    {#each fixes as fix (fix.part)}
      <FixCard {fix} />
    {/each}
    <GameLaidOut {game} />
  </div>
</main>
