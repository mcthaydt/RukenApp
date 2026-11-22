<!--
  A maker's page (spec 5.4): who they are, their games, then their links, in the four colours they picked. The colours
  reach the page as custom properties, so a page with no theme is felt and chalk with paper buttons and every theme is
  the same markup. It reads without script: a clip shows its first frame and every game and link is a plain link.
-->
<script lang="ts">
  import { loads } from "../../lib/loads.ts";
  import { quietVideo } from "../../lib/quiet-video.ts";

  interface Props {
    name: string;
    handle: string;
    oneLine: string;
    /** The photo's whole address, or null for the name's first letter in a circle. */
    photo: string | null;
    /** The four jobs the colours do, and every colour of the combination for the row of dots. */
    colours: { ground: string; text: string; button: string; buttonText: string; all: string[] };
    games: { slug: string; name: string; upright: string }[];
    links: { id: string; kind: "link" | "game_elsewhere"; title: string; site: string }[];
  }

  let { name, handle, oneLine, photo, colours, games, links }: Props = $props();

  // The first letter of the name, for a page with no photo. A name is never empty (the pages service refuses one).
  const initial = $derived(Array.from(name.trim())[0]?.toUpperCase() ?? "");
</script>

<main
  class="makerpage"
  style:--ground={colours.ground}
  style:--text={colours.text}
  style:--button={colours.button}
  style:--button-text={colours.buttonText}
>
  <header class="who">
    {#if photo !== null}
      <img use:loads src={photo} alt="" width="96" height="96" />
    {:else}
      <span class="initial" aria-hidden="true">{initial}</span>
    {/if}
    <h1>{name}</h1>
    <p class="handle">@{handle}</p>
    {#if oneLine !== ""}
      <p class="line">{oneLine}</p>
    {/if}
    <p class="dots" aria-hidden="true">
      {#each colours.all as colour (colour)}
        <span class="dot" style:background-color={colour}></span>
      {/each}
    </p>
  </header>

  {#if games.length > 0}
    <section class="games" aria-label="Games">
      {#each games as game (game.slug)}
        <article class="game">
          <video
            use:loads
            src={`${game.upright}#t=0.001`}
            preload="metadata"
            tabindex="-1"
            muted
            loop
            playsinline
            aria-hidden="true"
            use:quietVideo
          ></video>
          <h2><a href={`/g/${game.slug}`}>{game.name}</a></h2>
          <a class="play" href={`/g/${game.slug}/play`}>Play</a>
        </article>
      {/each}
    </section>
  {/if}

  {#if links.length > 0}
    <nav class="links" aria-label="Links">
      {#each links as link (link.id)}
        <!-- A made-up address would still be a link to somewhere: the visitor always goes through ours, which sends on only an address that was checked as https. -->
        <a
          class={link.kind === "game_elsewhere" ? "elsewhere" : "button"}
          href={`/${handle}/out/${link.id}`}
          rel="nofollow ugc noopener"
        >
          <span class="linktitle">{link.title}</span>
          {#if link.kind === "game_elsewhere"}
            <span class="site">A game on {link.site}</span>
          {/if}
        </a>
      {/each}
    </nav>
  {/if}
</main>

<style>
  .makerpage {
    --ground: #112f2c;
    --text: #ffffff;
    --button: #ffffff;
    --button-text: #111314;
    box-sizing: border-box;
    min-height: 100dvh;
    margin: 0;
    padding: 2rem 1rem 6rem;
    background: var(--ground);
    color: var(--text);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
  }
  /* A phone held sideways: the bar stands along the right edge and the page keeps clear of it (look.css sets --rail),
     with its own colour still reaching the edge under the bar. */
  @media (orientation: landscape) and (max-height: 449px) {
    .makerpage {
      margin-right: calc(-1 * var(--rail, 0px));
      padding: 1rem calc(1rem + var(--rail, 0px)) 1rem 1rem;
      gap: 1rem;
    }
    .who img,
    .initial {
      width: 64px;
      height: 64px;
      font-size: 1.75rem;
    }
  }
  .who,
  .links {
    width: 100%;
    max-width: 30rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
  }
  .who > * {
    max-width: 100%;
    margin: 0;
    overflow-wrap: anywhere;
  }
  .who img,
  .initial {
    width: 96px;
    height: 96px;
    border-radius: 50%;
    object-fit: cover;
  }
  .initial {
    display: grid;
    place-items: center;
    background: var(--button);
    color: var(--button-text);
    font-size: 2.5rem;
    font-weight: 700;
  }
  h1 {
    font-size: 2rem;
    line-height: 1.15;
  }
  .handle {
    opacity: 0.8;
  }
  .dots {
    display: flex;
    gap: 0.5rem;
  }
  .dot {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    border: 1px solid var(--text);
  }
  .games {
    width: 100%;
    max-width: 60rem;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }
  @media (min-width: 48rem) {
    .games {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
  .game {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 0;
  }
  .game video {
    width: 100%;
    aspect-ratio: 9 / 16;
    object-fit: cover;
    border-radius: 12px;
    background: #111314;
  }
  .game h2 {
    margin: 0;
    font-size: 1rem;
    overflow-wrap: anywhere;
  }
  .game h2 a {
    display: flex;
    align-items: center;
    min-height: 48px;
    color: inherit;
  }
  .play,
  .links a {
    box-sizing: border-box;
    min-height: 48px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1rem;
    border-radius: 12px;
    background: var(--button);
    color: var(--button-text);
    font-weight: 700;
    text-decoration: none;
    overflow-wrap: anywhere;
  }
  /* A column that centres its items sizes a long unbroken title to its full length, so the title is held to the
     button's width instead and breaks inside it. */
  .links a {
    width: 100%;
    align-items: stretch;
    text-align: center;
    font-size: 1.125rem;
  }
  .links .linktitle,
  .links .site {
    max-width: 100%;
  }
  .links .elsewhere .site {
    font-weight: 400;
    font-size: 0.875rem;
  }
  .play:focus-visible,
  .links a:focus-visible,
  .game h2 a:focus-visible {
    outline: 3px solid var(--text);
    outline-offset: 3px;
  }
</style>
