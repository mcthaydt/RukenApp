<!--
  A game that is live (spec 5c). Its own video fills the screen behind everything, blurred and dimmed, the upright one on
  an upright screen and the wide one on a wide screen; it moves only where a video may move by itself (quietVideo). In
  front: the line, the blue "See it on Ruken", a quiet outline send, and the way back. The send is "Send a new version"
  (copies the newest files and sends them for review in the one press), or, once staff sent back a name, a line or where
  it plays and it is mended, "Send it again" (sends the copy Ruken already holds, no copy from GitHub); while one of those
  is still to mend there is no send at all. Beside them the game laid out sharp, with a Change on its name, its
  line and where it plays only: its rating, files and videos go through staff again. Only the video of this window's shape
  is laid out, with the name, the line and the two chips (where it plays, who it is for). An update that was sent back is
  a card.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { onMount } from "svelte";
  import { mayMove, quietVideo } from "../../../lib/quiet-video.ts";
  import type { FixCardData, LaidOutGame } from "../laid-out.ts";
  import FixCard from "./FixCard.svelte";
  import GameLaidOut from "./GameLaidOut.svelte";

  let {
    name,
    line,
    send,
    fixes,
    seeAddress,
    backdrop,
    game,
    problem,
  }: {
    name: string;
    line: string;
    /** Which send is offered: a new version from GitHub, the held copy again, or none until what was sent back is mended. */
    send: "new_version" | "again" | "none";
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
  // Whether the circles drift: only where the video moves too, so a slow phone or a person who asked for less motion sees both still.
  let drifting = $state(false);
  // The first thing sent back that a link can mend, which the blue button names (as on Sent back).
  const first = $derived(fixes.find((fix) => fix.href !== null));
  const src = $derived(upright ? (backdrop.upright ?? backdrop.wide) : (backdrop.wide ?? backdrop.upright));

  onMount(() => {
    drifting = mayMove();
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
  <div class="backdrop" aria-hidden="true" data-drifting={drifting ? "" : undefined}>
    {#key src}
      <video {src} preload="metadata" muted loop playsinline use:quietVideo></video>
    {/key}
    <!-- Five soft circles between the video and the dark layer (Owner, 2026-11-15: circles are allowed here only). -->
    {#each [1, 2, 3, 4, 5] as circle (circle)}
      <i class="drift"></i>
    {/each}
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
    {#if first?.href !== undefined && first.href !== null}
      <div class="acts">
        <a class="button" href={first.href}>{first.fixWords}</a>
      </div>
      <p><a href={seeAddress}>See it on Ruken</a></p>
    {:else}
      <div class="acts">
        <a class="button" href={seeAddress}>See it on Ruken</a>
      </div>
    {/if}
    {#if send !== "none"}
      <form
        method="POST"
        action={send === "again" ? "?/sendAgain" : "?/newVersion"}
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
          {#if send === "again"}
            {sending ? "Sending your update…" : "Send it again"}
          {:else}
            {sending ? "Copying your game…" : "Send a new version"}
          {/if}
        </button>
        <p class="note">
          {#if send === "again"}
            Sends your update for review again. Players can still play it while you wait.
          {:else if sending}
            Copying your game can take a minute. Keep this page open.
          {:else}
            Copies the newest version of your game from GitHub and sends it for review. Players can still play
            it while you wait.
          {/if}
        </p>
      </form>
    {/if}
    <a class="foot" href="/make">Back to your games</a>
  </div>
  <div class="after">
    {#each fixes as fix (fix.part)}
      <FixCard {fix} />
    {/each}
    <!-- One video: the shape this window is, as the backdrop (spec 5c). -->
    <GameLaidOut {game} only={upright ? "upright" : "wide"} />
  </div>
</main>
