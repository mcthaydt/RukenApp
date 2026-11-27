<!--
  The feed's top bar (the owner, 2026-11-22: "search icon on the right; For You | Following in the middle", then on
  2026-11-27 names of Ruken's own, not TikTok's, and easy to translate): one row fixed at the top that holds the speaker
  on the left (given by the feed, Feed.svelte), two tabs in one frosted pill in the middle, Fresh (every game, the feed
  at /) and Followed (games from makers the person follows, at /followed), and Search, a round glass button on the
  right. The three share one centre line and never move with the clips under them (the owner, 2026-11-27: "they need
  to be grouped together as a unit"). The pill is no taller than the round buttons and its tabs are tight, so a third
  tab fits beside them on a 360px phone. The tabs are links, so they work without script, and moving between them
  slides sideways as the bar's places do (src/lib/page-moves.ts). A finger swiped sideways anywhere on the screen, or a
  gamepad's shoulder buttons (LB, RB), step to the tab beside this one (tabs.ts).
-->
<script lang="ts" module>
  import type { TabKey as Key } from "./tabs.ts";

  // Kept across tabs, not per bar: the bar for the new tab starts a moment after the move (most on Safari's engine),
  // and sampling the pad then would take a fresh press for the one that brought the person here. Only a button seen
  // down before the move is waited on; nothing is held when the feed first opens.
  let held: readonly number[] = [];
  // The tab a move is on its way to, so a second press or swipe made before it arrives steps on from there.
  let heading: Key | null = null;
</script>

<script lang="ts">
  import type { Snippet } from "svelte";
  import { goto } from "$app/navigation";
  import Icon from "../../lib/icon.svelte";
  import { LB, RB, TABS, onBrowserEdge, stepOfSwipe, tabFrom, type TabKey } from "./tabs.ts";

  let {
    on,
    sound,
  }: {
    /** Which tab the person is on. */
    on: TabKey;
    /** The speaker, where the screen has clips to play; its place stays empty otherwise, so the pill stays centred. */
    sound?: Snippet | undefined;
  } = $props();

  /** Goes to the tab `step` places along, if there is one, unless a sheet is open over the feed. */
  function stepTab(step: 1 | -1): void {
    if (document.querySelector("dialog[open]") !== null) return;
    const tab = tabFrom(heading ?? on, step);
    if (tab === null) return;
    heading = tab.key;
    void goto(tab.href).finally(() => {
      if (heading === tab.key) heading = null;
    });
  }

  // Where a one-finger touch started; a second finger, a touch that starts on an open sheet, or one that starts on the
  // screen's edge, where the browser's own Back and Forward swipe lives (tabs.ts), is not a swipe.
  let start: { x: number; y: number } | null = null;
  function touchStarted(event: TouchEvent): void {
    const touch = event.touches[0];
    start =
      event.touches.length === 1 &&
      touch !== undefined &&
      !onBrowserEdge(touch.clientX, window.innerWidth) &&
      document.querySelector("dialog[open]") === null
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  }
  function touchEnded(event: TouchEvent): void {
    const touch = event.changedTouches[0];
    if (start === null || touch === undefined || event.touches.length > 0) return;
    const step = stepOfSwipe(touch.clientX - start.x, touch.clientY - start.y);
    start = null;
    if (step !== null) stepTab(step);
  }

  // A gamepad is read while one is plugged in, each frame, and a shoulder button counts once as it goes down. Games are
  // played on their own page, so the feed's reading never takes a press meant for a game.
  $effect(() => {
    let frame = 0;
    function pressed(): { pads: number; down: number[] } {
      const pads = navigator.getGamepads().filter((pad) => pad !== null);
      const down = [LB, RB].filter((button) => pads.some((pad) => pad.buttons[button]?.pressed === true));
      return { pads: pads.length, down };
    }
    function read(): void {
      const { pads, down } = pressed();
      if (document.hasFocus()) {
        if (down.includes(LB) && !held.includes(LB)) stepTab(-1);
        else if (down.includes(RB) && !held.includes(RB)) stepTab(1);
      }
      held = down;
      frame = pads > 0 ? requestAnimationFrame(read) : 0;
    }
    function connected(): void {
      if (frame === 0) frame = requestAnimationFrame(read);
    }
    if (typeof navigator.getGamepads === "function") {
      window.addEventListener("gamepadconnected", connected);
      if (navigator.getGamepads().some((pad) => pad !== null)) connected();
    }
    return () => {
      window.removeEventListener("gamepadconnected", connected);
      cancelAnimationFrame(frame);
    };
  });
</script>

<svelte:window ontouchstart={touchStarted} ontouchend={touchEnded} ontouchcancel={() => (start = null)} />

<div class="top">
  <div class="left">
    {#if sound}{@render sound()}{/if}
  </div>
  <nav class="tabs" aria-label="Feeds">
    {#each TABS as tab (tab.key)}
      <a href={tab.href} aria-current={on === tab.key ? "page" : undefined}>{tab.name}</a>
    {/each}
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
    justify-content: center;
    min-width: var(--size-target);
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
  /* The narrowest phones (320 wide): smaller words and padding, so three tabs still fit beside the speaker and Search,
     whole and 48px tall. */
  @media (max-width: 359px) {
    .tabs a {
      padding: 0 0.25rem;
      font-size: 0.8125rem;
    }
  }
  /* A phone held sideways: the bar stands along the right edge, so Search sits at the top of that column, centred on it. */
  @media (orientation: landscape) and (max-height: 449px) {
    .top {
      padding-right: calc(max(0.75rem, env(safe-area-inset-right)) + 0.625rem);
    }
  }
</style>
