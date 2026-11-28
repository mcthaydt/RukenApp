<!--
  Search, opened from the feed's top bar (FeedTop.svelte): one field at the top, and under it the games and makers that
  match, found as the person types. It is a plain form that asks the page again with `?q=`, so it works without script
  (Enter searches); with script it searches a moment after the person stops typing, keeps the focus in the field, and
  puts each search in the address in place of the last, so Back leaves Search instead of stepping through every letter.
  The field and Back stay at the top; only the results scroll, in a view of their own (the owner, 2026-11-24: screens
  fit the view, and anything that must scroll does it inside its own view).
-->
<script lang="ts">
  import { goto } from "$app/navigation";
  import { navigating } from "$app/state";
  import Icon from "../../lib/icon.svelte";
  import { loads } from "../../lib/loads.ts";
  import type { Found } from "./search.ts";

  let {
    query,
    found,
    longest,
  }: {
    /** What the person searched for, as the address has it. */
    query: string;
    /** What it found, or null for no search yet. */
    found: Found | null;
    /** The longest search the field takes. */
    longest: number;
  } = $props();

  /** How long after the last key the search goes, so it does not ask once for every letter. */
  const TYPING_PAUSE_MS = 250;

  // The field starts with the search the page was opened with, and is the person's own after that.
  // svelte-ignore state_referenced_locally
  let typed = $state(query);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const initialOf = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? "";
  const searching = $derived(navigating.to?.url.pathname === "/search");

  function onInput(): void {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const wanted = typed.trim();
      void goto(wanted === "" ? "/search" : `/search?q=${encodeURIComponent(wanted)}`, {
        replace: true,
        // The person is still typing: the focus and where the results are scrolled stay as they are.
        reset: false,
      });
    }, TYPING_PAUSE_MS);
  }

  const nothing = $derived(found !== null && found.games.length === 0 && found.makers.length === 0);
</script>

<main class="search">
  <form method="get" action="/search" role="search">
    <a class="back" href="/" aria-label="Back"><Icon name="back" /></a>
    <!-- The person pressed Search to type here, so the field takes the keys at once. -->
    <!-- svelte-ignore a11y_autofocus -->
    <input
      type="search"
      name="q"
      aria-label="Search games and makers"
      placeholder="Games and makers"
      autocomplete="off"
      enterkeyhint="search"
      maxlength={longest}
      autofocus
      bind:value={typed}
      oninput={onInput}
    />
  </form>

  <div class="results" aria-busy={searching ? "true" : "false"} aria-live="polite">
    {#if found === null}
      <p class="statement">Find a game or a maker.</p>
    {:else if nothing}
      <p class="statement">Nothing found for “{query}”.</p>
      <p>Try a shorter word, or another name.</p>
    {:else}
      {#if found.games.length > 0}
        <h2>Games</h2>
        <ul>
          {#each found.games as game (game.slug)}
            <li>
              <!-- Not called "game": look.css's `a.game` is Your games' paper card, whose dark words then landed on this felt
                   one (the owner's iPad, 2026-11-28: the name and line all but invisible). -->
              <a class="row found" href={`/g/${game.slug}`} data-sveltekit-preload-data="off">
                <!-- The game's opening frame, so a person sees it before reading its name. A site that makes no stills
                     answers 404, and the tile stays as plain felt. -->
                <span class="thumb" aria-hidden="true">
                  {#if game.still !== null}
                    <img
                      use:loads
                      src={game.still}
                      alt=""
                      width="64"
                      height="80"
                      loading="lazy"
                      onerror={(event) => {
                        if (event.currentTarget instanceof HTMLImageElement)
                          event.currentTarget.hidden = true;
                      }}
                    />
                  {/if}
                </span>
                <span class="who">
                  <span class="name">{game.name}</span>
                  <span class="line">{game.oneLine}</span>
                  {#if game.maker !== null}
                    <span class="by">by {game.maker}</span>
                  {/if}
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
      {#if found.makers.length > 0}
        <h2>Makers</h2>
        <ul>
          {#each found.makers as maker (maker.handle)}
            <li>
              <a class="row maker" href={`/${maker.handle}`} data-sveltekit-preload-data="off">
                {#if maker.photo !== null}
                  <img use:loads src={maker.photo} alt="" width="48" height="48" loading="lazy" />
                {:else}
                  <span class="initial" aria-hidden="true">{initialOf(maker.name)}</span>
                {/if}
                <span class="who">
                  <span class="name">{maker.name}</span>
                  <span class="line">@{maker.handle}</span>
                </span>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
</main>

<style>
  /* The whole window above the bar: the field at the top and the results under it, which scroll on their own. */
  .search {
    position: fixed;
    inset: 0 0 var(--foot, 0);
    display: flex;
    flex-direction: column;
    width: min(100%, calc(var(--width-read) + 2rem));
    margin: 0 auto;
    padding: max(0.75rem, env(safe-area-inset-top)) 1rem 0;
  }
  form {
    flex: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .back {
    flex: none;
    display: grid;
    place-items: center;
    width: var(--size-target);
    min-height: var(--size-target);
    margin: 0;
    border-radius: 50%;
    --corner: round;
    background: var(--felt-raised);
    color: var(--chalk);
  }
  input {
    flex: 1;
    min-width: 0;
    margin: 0;
    border-color: var(--sage);
  }
  /* Ruken draws its own field (the owner, 2026-11-22: "EVERYTHING should be custom"), so not the browser's clear cross. */
  input::-webkit-search-cancel-button,
  input::-webkit-search-decoration {
    appearance: none;
  }
  input::placeholder {
    color: var(--sage);
    opacity: 1;
  }
  .results {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 1rem 0 1.5rem;
  }
  .results > p:first-child {
    margin-top: 1.5rem;
    text-align: center;
  }
  .results > p.statement + p {
    text-align: center;
  }
  h2 {
    margin: 1.5rem 0 0.5rem;
    font: var(--text-button);
    color: var(--sage);
  }
  h2:first-child {
    margin-top: 0.5rem;
  }
  ul {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.125rem;
    min-height: var(--size-target);
    margin: 0;
    padding: 0.75rem 1rem;
    border-radius: var(--radius-button);
    background: var(--felt-raised);
    color: var(--chalk);
  }
  .row:active {
    scale: var(--press-scale);
    transition: scale var(--press-time);
  }
  .row.maker,
  .row.found {
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
  }
  .row.found {
    padding-left: 0.5rem;
  }
  /* An upright clip's frame, cut to 4 by 5 like a post, on felt until it comes. */
  .thumb {
    flex: none;
    width: 64px;
    height: 80px;
    overflow: hidden;
    border-radius: var(--radius-small);
    background: var(--felt);
  }
  .thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .name {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .line,
  .by {
    font: var(--text-small);
    overflow-wrap: anywhere;
  }
  .by {
    color: var(--sage);
  }
  .maker img,
  .initial {
    flex: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    --corner: round;
    object-fit: cover;
  }
  .initial {
    display: grid;
    place-items: center;
    background: var(--paper);
    color: var(--ink);
    font-weight: 600;
  }
  /* A phone held sideways: the bar stands along the right edge, so the screen keeps clear of it. */
  @media (orientation: landscape) and (max-height: 449px) {
    .search {
      inset: 0 var(--rail, 0) 0 0;
      width: auto;
      margin: 0;
    }
  }
</style>
