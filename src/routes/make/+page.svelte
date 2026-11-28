<!--
  The maker's area. Each game is one paper card and the whole card is a link: its picture, its name, and where it
  stands with the one next step, in words. With none, what a maker needs ready. The one blue button is "Add a game".
  A game with files staff have not said yes to has a Test play button under its card. Signed out, the plus in the bar
  still lands here: a card that says what Ruken gives a maker, in the landing page's words, with Join Ruken and Sign in,
  both coming back here.
-->
<script lang="ts">
  import VideoTile from "./parts/VideoTile.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

{#if data.signedOut}
  <main class="card">
    <h1>Made a game?</h1>
    <ul class="bullets">
      <li>A person checks every game, so only good ones get in.</li>
      <li>Send it from GitHub in six short questions. The feed brings you players.</li>
      <li>Get paid by how long members play it.</li>
    </ul>
    <div class="ways">
      <a class="button" href="/sign-up?next=%2Fmake">Join Ruken</a>
      <a class="quiet" href="/sign-in?next=%2Fmake">Sign in</a>
    </div>
  </main>
{:else}
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
      <p><a class="go" href="/help/get-your-game-on-ruken?from=%2Fmake">Here's how, step by step</a></p>
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
      {#if game.testPlay}
        <!-- Beside the card, never inside it: the card is one link to the game. The name is in the label for a screen
           reader, since every game's button says the same words. It is not loaded ahead on hover: loading it hands out a
           play pass, so only a press should. -->
        <a
          class="button outline testplay"
          data-sveltekit-preload-data="off"
          href={`/make/${game.slug}/play`}
          aria-label={`Test play ${game.name}`}>Test play</a
        >
      {/if}
    {/each}
    <!-- Your page, the agreement a maker accepted before their first game, kept where they can read it again, and the
       guides: → links on one line, wrapping on a phone. -->
    <p class="ways">
      <a class="go" href="/make/page">Your page</a>
      <a class="go" href="/legal/maker-agreement">Maker agreement</a>
      <a class="go" href="/help">Help for makers</a>
    </p>
  </main>
{/if}
