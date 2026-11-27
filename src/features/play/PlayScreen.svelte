<!--
  Playing (spec 4): the game fills the window, and Ruken's one control is a small see-through Menu tab. The tab can be
  dragged to either side and up and down, or moved with the arrow keys, and it remembers where it was left. Pressing it
  opens a menu over the dimmed game: Keep playing, Full screen (only where the page can go full screen), Start again and
  Leave game. A stray tap never ends a game. With no script the <details> opens by itself and Leave game is a link.

  The same screen is a maker's test play of files staff have not said yes to: then a strip across the top says so, the
  menu says so, Leave goes back to the maker's game, and no beats are sent (a test play is never counted).
-->
<script lang="ts">
  import { deviceStore } from "../consent/consent.browser.ts";
  import { gameTitle } from "../../lib/titles.ts";
  import { PAD_MENU, padConnected } from "../../lib/pad-focus.ts";
  import { onMount } from "svelte";
  import {
    dragSpot,
    FIRST_PLACE,
    heightRange,
    isDrag,
    readPlace,
    tabByKey,
    tabRest,
    TAB_WIDTH,
    type TabPlace,
  } from "./menu-tab.ts";
  import { createAttention } from "./attention.ts";
  import { BEAT_EVERY_MS } from "./time.ts";

  interface Props {
    name: string;
    /** The maker's page name, or null when they have no page. */
    makerName: string | null;
    frameUrl: string;
    frameRules: { sandbox: string; allow: string };
    /** Where the page sends its "still here" beats, and the session they are for. Null for a test play. */
    beats: { address: string; session: { id: string; token: string } } | null;
    /** Where Leave game goes, and the line under it. */
    leave: { href: string; note: string };
    testPlay: boolean;
  }

  let { name, makerName, frameUrl, frameRules, beats, leave, testPlay }: Props = $props();

  const PLACE_KEY = "rk_menu_tab";
  const SLOW_AFTER_MS = 20_000;

  let stage = $state<HTMLElement>();
  let frame = $state<HTMLIFrameElement>();
  let menu = $state<HTMLDetailsElement>();
  let tab = $state<HTMLElement>();
  let panel = $state<HTMLElement>();
  let open = $state(false);
  let started = $state(false);
  // True once the script is running: the starting words need it to go away again, so with no script there are none.
  let alive = $state(false);
  let slow = $state(false);
  let canFullScreen = $state(false);
  let fullScreen = $state(false);
  let place = $state<TabPlace>(FIRST_PLACE);

  // The tab's height is a custom property the stylesheet reads: set here, in script, never written into the markup.
  $effect(() => {
    stage?.style.setProperty("--tab-at", String(place.height));
  });

  function remember(next: TabPlace): void {
    place = next;
    // Kept on the device only after a yes (deviceStore); until then the tab still moves, and comes back at the first place.
    deviceStore.set(PLACE_KEY, JSON.stringify(next));
  }

  function insets(): { top: number; bottom: number } {
    const probe = getComputedStyle(document.documentElement);
    return {
      top: Number.parseFloat(probe.getPropertyValue("--inset-top")) || 0,
      bottom: Number.parseFloat(probe.getPropertyValue("--inset-bottom")) || 0,
    };
  }

  onMount(() => {
    const kept = readPlace(deviceStore.get(PLACE_KEY));
    if (kept !== null) place = kept;

    alive = true;
    canFullScreen = document.fullscreenEnabled;
    const onFullScreen = () => {
      fullScreen = document.fullscreenElement !== null;
    };
    document.addEventListener("fullscreenchange", onFullScreen);

    // A frame that finished loading before the script started has already missed its own `load`; the window's own
    // `load` waits for frames, so it is the same fact.
    if (document.readyState === "complete") started = true;
    const slowTimer = setTimeout(() => (slow = true), SLOW_AFTER_MS);

    // Play time (spec 4.2): look once a second; every beat's worth of time say whether every look was attentive. The page
    // never focuses the game by itself: time starts when the person first presses the game, or Keep playing.
    const attention = createAttention();
    const look = () => {
      const box = frame?.getBoundingClientRect();
      attention.look({
        tabShowing: document.visibilityState === "visible",
        frameOnScreen:
          box !== undefined &&
          box.bottom > 0 &&
          box.right > 0 &&
          box.top < innerHeight &&
          box.left < innerWidth,
        frameFocused: document.activeElement === frame && document.hasFocus(),
      });
    };
    const beatAddress = beats?.address ?? "";
    const body = (attentive: boolean) =>
      JSON.stringify({ session: beats?.session.id, token: beats?.session.token, attentive });
    let ticks = 0;
    // A test play has no session, so it sends nothing.
    let stopped = beats === null;
    const tick = async () => {
      look();
      ticks += 1;
      if (stopped || ticks * 1000 < BEAT_EVERY_MS) return;
      ticks = 0;
      try {
        const answer = await fetch(beatAddress, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body(attention.report()),
          keepalive: true,
        });
        if (answer.status === 204) attention.taken();
        // A session that is over or unknown takes no more beats.
        if (answer.status === 410 || answer.status === 404) stopped = true;
      } catch {
        // A beat that did not arrive is spoken for by the next one (`taken` was not called).
      }
    };
    const timer = setInterval(() => void tick(), 1000);
    const onVisible = () => {
      look();
    };
    document.addEventListener("visibilitychange", onVisible);
    const onLeave = () => {
      if (!stopped) navigator.sendBeacon(beatAddress, body(attention.report()));
    };
    addEventListener("pagehide", onLeave);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      removeEventListener("pagehide", onLeave);
      document.removeEventListener("fullscreenchange", onFullScreen);
      clearTimeout(slowTimer);
    };
  });

  function onToggle(): void {
    open = menu?.open ?? false;
    if (!open) return;
    const first = (): void => panel?.querySelector<HTMLElement>("button, a")?.focus();
    first();
    // The sheet has only just been shown: if the browser did not take the focus, ask again on the next frame.
    requestAnimationFrame(() => {
      if (open && panel !== undefined && !panel.contains(document.activeElement)) first();
    });
  }

  function keepPlaying(): void {
    if (menu !== undefined) menu.open = false;
    open = false;
    frame?.focus();
  }

  function onKeydown(event: KeyboardEvent): void {
    // Read the menu itself: its toggle event arrives a moment after it is shown.
    if (menu === undefined || !menu.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      menu.open = false;
      open = false;
      tab?.focus();
      return;
    }
    // Focus stays inside the menu while it is open.
    if (event.key === "Tab" && panel !== undefined) {
      const stops = [...panel.querySelectorAll<HTMLElement>("button, a[href]")];
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  // The gamepad's Home (or View held) opens the menu over the game, and closes it again (src/lib/pad-focus.ts).
  function padMenu(): void {
    if (menu === undefined) return;
    if (menu.open) keepPlaying();
    else menu.open = true;
  }
  $effect(() => {
    addEventListener(PAD_MENU, padMenu);
    return () => {
      removeEventListener(PAD_MENU, padMenu);
    };
  });

  // The tab. A press that moves more than 8px is a drag; one that moves less is a press and opens the menu.
  let dragFrom: { x: number; y: number; grabX: number; grabY: number } | null = null;
  let dragged = false;

  function dragStart(event: PointerEvent): void {
    if (tab === undefined || event.button > 0) return;
    const box = tab.getBoundingClientRect();
    dragFrom = {
      x: event.clientX,
      y: event.clientY,
      grabX: event.clientX - box.left,
      grabY: event.clientY - box.top,
    };
    dragged = false;
    tab.setPointerCapture(event.pointerId);
  }

  function dragMove(event: PointerEvent): void {
    if (dragFrom === null || menu === undefined) return;
    if (!dragged && !isDrag(event.clientX - dragFrom.x, event.clientY - dragFrom.y)) return;
    dragged = true;
    const spot = spotUnder(event, dragFrom);
    menu.setAttribute("data-dragging", "");
    // The tab faces the way it will snap, so its rounded edge turns as soon as it passes the middle.
    menu.setAttribute("data-lean", spot.left + TAB_WIDTH / 2 > innerWidth / 2 ? "right" : "left");
    menu.style.setProperty("--drag-x", `${String(spot.left)}px`);
    menu.style.setProperty("--drag-top", `${String(spot.top)}px`);
  }

  // Where the tab is drawn for a pointer at this point, kept inside the window.
  function spotUnder(
    event: PointerEvent,
    from: { grabX: number; grabY: number },
  ): { left: number; top: number } {
    return dragSpot({
      left: event.clientX - from.grabX,
      top: event.clientY - from.grabY,
      windowWidth: innerWidth,
      windowHeight: innerHeight,
      insets: insets(),
    });
  }

  function dragEnd(event: PointerEvent): void {
    if (dragFrom === null || menu === undefined) return;
    const from = dragFrom;
    dragFrom = null;
    if (!dragged) return;
    const { left, top } = spotUnder(event, from);
    remember(
      tabRest({
        centreX: left + TAB_WIDTH / 2,
        top,
        windowWidth: innerWidth,
        windowHeight: innerHeight,
        insets: insets(),
      }),
    );
    menu.removeAttribute("data-dragging");
    menu.removeAttribute("data-lean");
  }

  // A click that ends a drag must not open the menu.
  function tabClick(event: MouseEvent): void {
    if (dragged) {
      event.preventDefault();
      dragged = false;
    }
  }

  function tabKey(event: KeyboardEvent): void {
    if (event.key.startsWith("Arrow")) {
      const range = heightRange(innerHeight, insets());
      // A height kept from a taller window is shown held to this one, so the keys start from where it is seen.
      const shown = { ...place, height: Math.min(Math.max(place.height, range.least), range.most) };
      const next = tabByKey(shown, event.key, range);
      if (next !== null) {
        event.preventDefault();
        remember(next);
      }
    }
  }

  async function toggleFullScreen(): Promise<void> {
    try {
      if (document.fullscreenElement !== null) await document.exitFullscreen();
      else await stage?.requestFullscreen();
    } catch {
      // A browser that refuses simply stays as it is.
    }
  }

  function startAgain(): void {
    started = false;
    slow = false;
    keepPlaying();
    // Setting the address again loads the game again; the pass lasts a day, so it needs no new one.
    frame?.setAttribute("src", frameUrl);
  }
</script>

<svelte:head>
  <title>{gameTitle(name)}</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<main class="playing" data-testing={testPlay ? "" : undefined} bind:this={stage}>
  {#if testPlay}
    <p class="teststrip">Test play. Only you can see this.</p>
  {/if}
  <iframe
    class="frame"
    title={name}
    src={frameUrl}
    sandbox={frameRules.sandbox}
    allow={frameRules.allow}
    referrerpolicy="no-referrer"
    bind:this={frame}
    data-pad-first
    onload={() => {
      started = true;
      slow = false;
      // With a gamepad the game takes it once it has loaded, as Keep playing gives it; with nothing focused the
      // pad's presses would move Ruken's focus instead, and never reach the game (src/lib/pad-focus.ts).
      if (padConnected() && menu?.open !== true) frame?.focus();
    }}
  ></iframe>

  {#if alive && !started}
    <div class="starting">
      {#if slow}
        <p class="statement">{name} is taking a while.</p>
        <div class="playrow">
          <button type="button" class="outline" onclick={startAgain}>Start again</button>
          <a class="button safe" href={leave.href}>Leave game</a>
        </div>
      {:else}
        <p class="statement">{name}</p>
        <p class="note"><span class="spinner" role="progressbar" aria-label={`Starting ${name}`}></span></p>
      {/if}
    </div>
  {/if}

  <details class="menu" bind:this={menu} data-side={place.side} ontoggle={onToggle}>
    <summary
      bind:this={tab}
      aria-label="Menu. Use the arrow keys to move it."
      onpointerdown={dragStart}
      onpointermove={dragMove}
      onpointerup={dragEnd}
      onpointercancel={dragEnd}
      onclick={tabClick}
      onkeydown={tabKey}
    >
      <span aria-hidden="true">RKN</span>
    </summary>
    <div class="menusheet">
      <div class="menupanel" bind:this={panel} data-pad-scope={open ? "" : undefined}>
        <h2>{name}</h2>
        {#if testPlay}
          <p class="note">Test play. Only you can see this.</p>
        {:else}
          <p class="note">{makerName === null ? "Made on Ruken" : `by ${makerName}`}</p>
        {/if}
        <button type="button" data-pad-back onclick={keepPlaying}>Keep playing</button>
        {#if canFullScreen}
          <button type="button" class="outline" onclick={toggleFullScreen}>
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"
              ><path
                d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              /></svg
            >
            <span><b>{fullScreen ? "Leave full screen" : "Full screen"}</b></span>
          </button>
        {/if}
        <button type="button" class="outline" onclick={startAgain}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"
            ><path
              d="M20 12a8 8 0 1 1-2.4-5.7M20 4v5h-5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          <span><b>Start again</b><small>Use this if the game is stuck.</small></span>
        </button>
        <a class="button safe" href={leave.href}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"
            ><path
              d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          <span><b>Leave game</b><small>{leave.note}</small></span>
        </a>
      </div>
    </div>
  </details>
</main>
