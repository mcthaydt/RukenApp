<!--
  The feed's top bar (the owner, 2026-11-22: "search icon on the right; For You | Following in the middle", then on
  2026-11-27 names of Ruken's own, not TikTok's, and easy to translate): one row fixed at the top that holds the speaker
  on the left (given by the feed, Feed.svelte), two tabs in one frosted pill in the middle, Fresh (every game, the feed
  at /) and Followed (games from makers the person follows, at /followed), and Search, a round glass button on the
  right. The three share one centre line and never move with the clips under them (the owner, 2026-11-27: "they need
  to be grouped together as a unit"). The pill is no taller than the round buttons and its tabs are tight, so a third
  tab fits beside them on a 360px phone. The tabs are links, so they work without script, and moving between them
  slides sideways as the bar's places do (src/lib/page-moves.ts).
-->
<script lang="ts">
  import type { Snippet } from "svelte";
  import Icon from "../../lib/icon.svelte";

  let {
    on,
    sound,
  }: {
    /** Which tab the person is on. */
    on: "fresh" | "followed";
    /** The speaker, where the screen has clips to play; its place stays empty otherwise, so the pill stays centred. */
    sound?: Snippet | undefined;
  } = $props();
</script>

<div class="top">
  <div class="left">
    {#if sound}{@render sound()}{/if}
  </div>
  <nav class="tabs" aria-label="Feeds">
    <a href="/" aria-current={on === "fresh" ? "page" : undefined}>Fresh</a>
    <a href="/followed" aria-current={on === "followed" ? "page" : undefined}>Followed</a>
  </nav>
  <a class="search" href="/search" aria-label="Search" title="Search"><Icon name="search" /></a>
</div>

<style>
  /* Three columns: the speaker's and Search's are the same width, so the pill sits in the very middle of the window. */
  .top {
    position: fixed;
    top: max(0.75rem, env(safe-area-inset-top));
    right: 0;
    left: 0;
    z-index: 5;
    display: grid;
    grid-template-columns: var(--size-target) 1fr var(--size-target);
    align-items: center;
    gap: 0.375rem;
    padding: 0 max(0.75rem, env(safe-area-inset-right)) 0 max(0.75rem, env(safe-area-inset-left));
    /* Only the controls take a press: a swipe or a press between them reaches the clip underneath. */
    pointer-events: none;
  }
  .left {
    display: grid;
  }
  .left > :global(*),
  .tabs,
  .search {
    pointer-events: auto;
  }
  .tabs {
    justify-self: center;
    display: flex;
    min-width: 0;
    border-radius: var(--radius-button);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  .tabs a {
    display: flex;
    align-items: center;
    min-height: var(--size-target);
    margin: 0;
    padding: 0 0.5rem;
    border-radius: var(--radius-button);
    color: var(--chalk);
    font-size: 0.9375rem;
    font-weight: 600;
    text-decoration: none;
    text-shadow: var(--glass-ink);
    white-space: nowrap;
  }
  /* The tab the person is on: a brighter pill of the same glass, as in the bar at the bottom. */
  .tabs a[aria-current="page"] {
    background: var(--glass-lift);
    box-shadow: var(--glass-edge);
  }
  .search {
    display: grid;
    place-items: center;
    width: var(--size-target);
    min-height: var(--size-target);
    margin: 0;
    padding: 0;
    border-radius: 50%;
    --corner: round;
    background: var(--glass-bg);
    color: var(--chalk);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  .search :global(.icon) {
    width: 26px;
    height: 26px;
    filter: var(--glass-icon);
    /* Its own layer, so its shadow is drawn once, not again each frame the video under the glass moves. */
    will-change: transform;
  }
  .tabs a:focus-visible,
  .search:focus-visible {
    outline-color: var(--chalk);
    outline-offset: -4px;
  }
  .tabs a:active,
  .search:active {
    scale: var(--press-scale);
    transition: scale var(--press-time);
  }
  /* A phone held sideways: the bar stands along the right edge, so Search sits at the top of that column, centred on it. */
  @media (orientation: landscape) and (max-height: 449px) {
    .top {
      padding-right: calc(max(0.75rem, env(safe-area-inset-right)) + 0.625rem);
    }
  }
</style>
