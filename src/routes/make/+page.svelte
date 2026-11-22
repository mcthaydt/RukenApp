<!--
  The maker's area. Each game is one paper card and the whole card is a link: its picture, its name, and where it
  stands with the one next step, in words. With none, what a maker needs ready. The one blue button is "Add a game".
-->
<script lang="ts">
  import VideoTile from "./parts/VideoTile.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Your games · Ruken</title>
</svelte:head>

<main class="games">
  <h1>Your games</h1>
  <p data-acceptance>{data.acceptance}</p>
  {#if data.thrown !== null}
    <p role="status">{data.thrown} was thrown away.</p>
  {/if}
  {#if data.githubFailed}
    <p class="problem" role="alert">GitHub didn't connect. Try again.</p>
    {#if data.games.length > 0}
      <p>Open your game to try again.</p>
    {/if}
  {/if}
  {#if data.games.length === 0}
    <p>You haven't added a game yet.</p>
    <p>You'll need your game on GitHub, ready to run in a browser, and two short videos of it.</p>
    <p><a href="/help/get-your-game-on-ruken?from=%2Fmake">Here's how, step by step</a></p>
  {/if}
  <div class="acts">
    <a class="button" href="/make/new">Add a game</a>
  </div>
  {#each data.games as game (game.slug)}
    <a class="game" href={`/make/${game.slug}`}>
      <!-- The game's picture is its wide video's first frame; until it has one a plain block holds its place. -->
      <VideoTile src={game.still} shape="wide" still />
      <span>
        <span class="statement">{game.name}</span>
        <span data-sent-back={game.words.startsWith("Sent back") ? "" : undefined}>{game.words}</span>
      </span>
    </a>
  {/each}
  <!-- Your page, the agreement a maker accepted before their first game, kept where they can read it again, and the
       guides. One note, so the links have a line's room above them. -->
  <p class="note">
    <a href="/make/page">Your page</a> · <a href="/legal/maker-agreement">Maker agreement</a> ·
    <a href="/help">Help</a>
  </p>
</main>
