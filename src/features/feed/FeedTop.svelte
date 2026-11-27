<!--
  The feed's top bar (the owner, 2026-11-22: "search icon on the right; For You | Following in the middle"): two tabs in
  one frosted pill in the middle, For you (every game, the feed at /) and Following (games from makers the person
  follows, at /following), and Search, a round glass button on the right. The speaker for sound stays in the top left
  corner (Feed.svelte), so the bar keeps clear of it. The tabs are links, so they work without script, and moving between
  them slides sideways as the bar's places do (src/lib/page-moves.ts).
-->
<script lang="ts">
  import Icon from "../../lib/icon.svelte";

  /** Which tab the person is on. */
  let { on }: { on: "for-you" | "following" } = $props();
</script>

<div class="top">
  <nav class="tabs" aria-label="Feeds">
    <a href="/" aria-current={on === "for-you" ? "page" : undefined}>For you</a>
    <a href="/following" aria-current={on === "following" ? "page" : undefined}>Following</a>
  </nav>
  <a class="search" href="/search" aria-label="Search" title="Search"><Icon name="search" /></a>
</div>

<style>
  .top {
    position: fixed;
    top: max(0.75rem, env(safe-area-inset-top));
    right: 0;
    left: 0;
    z-index: 5;
    display: flex;
    justify-content: center;
    padding: 0 0.75rem;
    /* Only the tabs and Search take a press: a swipe or a press between them reaches the clip underneath. */
    pointer-events: none;
  }
  .tabs,
  .search {
    pointer-events: auto;
  }
  .tabs {
    display: flex;
    gap: 0.125rem;
    padding: 0.125rem;
    border-radius: calc(var(--radius-button) + 0.125rem);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  .tabs a {
    display: flex;
    align-items: center;
    min-height: 2.75rem;
    margin: 0;
    padding: 0 0.875rem;
    border-radius: var(--radius-button);
    color: var(--chalk);
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
    position: absolute;
    top: 0;
    right: max(0.75rem, env(safe-area-inset-right));
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
    .search {
      right: calc(max(0.75rem, env(safe-area-inset-right)) + 0.625rem);
    }
  }
</style>
