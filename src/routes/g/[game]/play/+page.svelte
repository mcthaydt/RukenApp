<!--
  Playing (spec 4): the game fills the window, and Ruken's one control is a small see-through Menu tab. The tab can be
  dragged to either side and up and down, or moved with the arrow keys, and it remembers where it was left. Pressing it
  opens a menu over the dimmed game: Keep playing, Full screen (only where the page can go full screen), Start again and
  Leave game. A stray tap never ends a game. With no script the <details> opens by itself and Leave game is a link.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import {
    BEAT_EVERY_MS,
    createAttention,
    FIRST_PLACE,
    heightRange,
    isDrag,
    readPlace,
    tabByKey,
    tabRest,
    TAB_WIDTH,
    type TabPlace,
  } from "../../../../features/play/play.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const PLACE_KEY = "rk_menu_tab";
  const SEEN_KEY = "rk_seen_menu";
  const SLOW_AFTER_MS = 20_000;
  const HINT_FOR_MS = 5_000;

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
  let hint = $state(true);
  let canFullScreen = $state(false);
  let fullScreen = $state(false);
  let place = $state<TabPlace>(FIRST_PLACE);

  // The tab's height is a custom property the stylesheet reads: set here, in script, never written into the markup.
  $effect(() => {
    stage?.style.setProperty("--tab-at", String(place.height));
  });

  function remember(next: TabPlace): void {
    place = next;
    try {
      localStorage.setItem(PLACE_KEY, JSON.stringify(next));
    } catch {
      // A browser that keeps nothing still moves the tab; it just comes back at the first place.
    }
  }

  function insets(): { top: number; bottom: number } {
    const probe = getComputedStyle(document.documentElement);
    return {
      top: Number.parseFloat(probe.getPropertyValue("--inset-top")) || 0,
      bottom: Number.parseFloat(probe.getPropertyValue("--inset-bottom")) || 0,
    };
  }

  onMount(() => {
    const kept = (() => {
      try {
        return readPlace(localStorage.getItem(PLACE_KEY));
      } catch {
        return null;
      }
    })();
    if (kept !== null) place = kept;

    alive = true;
    canFullScreen = document.fullscreenEnabled;
    const onFullScreen = () => {
      fullScreen = document.fullscreenElement !== null;
    };
    document.addEventListener("fullscreenchange", onFullScreen);

    // The line beside the tab shows once on a device, for five seconds. Without script it simply stays.
    let hintTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (localStorage.getItem(SEEN_KEY) === null) {
        localStorage.setItem(SEEN_KEY, "yes");
        hintTimer = setTimeout(() => (hint = false), HINT_FOR_MS);
      } else {
        hint = false;
      }
    } catch {
      hintTimer = setTimeout(() => (hint = false), HINT_FOR_MS);
    }

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
    const beatAddress = `/g/${data.slug}/play/beat`;
    const body = (attentive: boolean) =>
      JSON.stringify({ session: data.session.id, token: data.session.token, attentive });
    let ticks = 0;
    let stopped = false;
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
      if (hintTimer !== undefined) clearTimeout(hintTimer);
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
    menu.setAttribute("data-dragging", "");
    menu.style.setProperty("--drag-x", `${String(event.clientX - dragFrom.grabX)}px`);
    menu.style.setProperty("--drag-top", `${String(event.clientY - dragFrom.grabY)}px`);
  }

  function dragEnd(event: PointerEvent): void {
    if (dragFrom === null || menu === undefined) return;
    const from = dragFrom;
    dragFrom = null;
    if (!dragged) return;
    const left = event.clientX - from.grabX;
    const top = event.clientY - from.grabY;
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
      const next = tabByKey(place, event.key, heightRange(innerHeight, insets()));
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
    frame?.setAttribute("src", data.frameUrl);
  }
</script>

<svelte:head>
  <title>{data.name} · Ruken</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<main class="playing" bind:this={stage}>
  <iframe
    class="frame"
    title={data.name}
    src={data.frameUrl}
    sandbox={data.frame.sandbox}
    allow={data.frame.allow}
    referrerpolicy="no-referrer"
    bind:this={frame}
    onload={() => {
      started = true;
      slow = false;
    }}
  ></iframe>

  {#if alive && !started}
    <div class="starting">
      {#if slow}
        <p class="statement">{data.name} is taking a while.</p>
        <div class="playrow">
          <button type="button" class="outline" onclick={startAgain}>Start again</button>
          <a class="button safe" href={`/g/${data.slug}`}>Leave game</a>
        </div>
      {:else}
        <p class="statement">{data.name}</p>
        <p class="note">Starting {data.name}…</p>
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
      <span aria-hidden="true">≡</span>
      <span aria-hidden="true">Menu</span>
    </summary>
    <div class="menusheet">
      <div class="menupanel" bind:this={panel}>
        <h2>{data.name}</h2>
        {#if data.makerName !== null}
          <p class="note">by {data.makerName}</p>
        {/if}
        <button type="button" onclick={keepPlaying}>Keep playing</button>
        {#if canFullScreen}
          <button type="button" class="outline" onclick={toggleFullScreen}>
            {fullScreen ? "Leave full screen" : "Full screen"}
          </button>
        {/if}
        <button type="button" class="outline" onclick={startAgain}>Start again</button>
        <a class="button safe" href={`/g/${data.slug}`}>Leave game</a>
        <p class="note">Not working? Choose Start again.</p>
      </div>
    </div>
  </details>
  <!-- Beside the tab, and outside the <details>, which hides everything but its summary while it is shut. -->
  {#if hint}
    <p class="menuhint">Choose Menu to leave the game. You can move it.</p>
  {/if}
</main>
