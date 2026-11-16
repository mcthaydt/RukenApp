<!--
  The play screen, as Ruken's first version had it (Owner, 2026-11-16: "copy ruken v1s play screen almost identical,
  functionality and look"). The game fills the window. Ruken's one control on it is the edge tab, a small "R" on the
  window's edge that opens the Ruken menu. The menu names the game and holds Back to game, Fullscreen and Exit game;
  Exit game asks first, and then goes back to the game's page. Until the game has loaded, a cover says it is getting
  ready, with a way back.

  The tab is faded while nobody is on it, so it covers less of the game. It can be dragged up and down its edge and
  over to the other one, and the arrow keys move it too; where it was left is kept on the device.

  The frame is put in once the page's script runs, already holding the game's address, so the one load it reports
  is the game's: never missed, and never the empty page a frame starts as.
  Leaving the page removes the frame, so a game that keeps running while hidden stops.

  While the game is played the page tells the server, every 15 seconds, whether the person was there the whole time:
  the tab showing, the game on screen and the game being what they last touched. It never puts the game in focus
  itself, so time starts only when the person first taps or clicks the game.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { BEAT_EVERY_MS, createAttention } from "../../../../features/play/play.browser.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  /** How long the cover waits before it says loading is taking a while. */
  const SLOW_MS = 10_000;
  /** How far a press may move before it is a drag: a finger always wobbles a little. */
  const DRAG_PX = 6;
  /** How far one arrow key moves the tab. */
  const NUDGE_PX = 48;
  /** Where the tab was left on this device. */
  const PLACE = "rk_tab_place";

  let frame: HTMLIFrameElement | undefined = $state();
  let tab: HTMLButtonElement | undefined = $state();
  let menu: HTMLDialogElement | undefined = $state();
  let exit: HTMLDialogElement | undefined = $state();

  let src: string | undefined = $state();
  let ready = $state(false);
  let slow = $state(false);
  let menuOpen = $state(false);
  let fullscreen = $state(false);
  let noFullscreen = $state(false);
  let online = $state(true);

  // The tab's place: which edge, and how far down the window its middle is, as a share of the height, so it keeps
  // its place when the window turns.
  let edge: "left" | "right" = $state("right");
  let down = $state(0.5);
  let dragging = $state(false);
  let hovered = $state(false);
  let focused = $state(false);
  const resting = $derived(!hovered && !focused && !dragging && !menuOpen);

  // A position is a computed number, not a colour, and the look forbids style attributes in markup, so the script
  // writes it.
  $effect(() => {
    tab?.style.setProperty("--down", String(down));
  });

  onMount(() => {
    src = data.frame.src;
    const timer = setTimeout(() => {
      slow = true;
    }, SLOW_MS);
    online = navigator.onLine;
    const goOnline = () => (online = true);
    const goOffline = () => (online = false);
    const fullscreenChanged = () => (fullscreen = document.fullscreenElement !== null);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    document.addEventListener("fullscreenchange", fullscreenChanged);
    // Storage can be refused (a private window); then the tab starts in its usual place, which is no harm.
    try {
      const kept = JSON.parse(localStorage.getItem(PLACE) ?? "null") as {
        edge?: unknown;
        down?: unknown;
      } | null;
      if (kept?.edge === "left" || kept?.edge === "right") edge = kept.edge;
      if (typeof kept?.down === "number") down = clampDown(kept.down);
    } catch {
      // Keep the usual place.
    }
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("fullscreenchange", fullscreenChanged);
    };
  });

  function loaded(): void {
    ready = true;
  }

  /** Keeps the whole tab on screen: half its height from the top and from the bottom. */
  function clampDown(share: number): number {
    const half = 28 / Math.max(window.innerHeight, 56);
    return Math.min(1 - half, Math.max(half, share));
  }

  function keepPlace(): void {
    try {
      localStorage.setItem(PLACE, JSON.stringify({ edge, down }));
    } catch {
      // Not kept; it comes back to the usual place next time.
    }
  }

  // A press that moves less than DRAG_PX is a press and opens the menu; a drag never does. The browser follows the
  // release of a drag with a click, which must be swallowed.
  let press: { id: number; x: number; y: number; down: number } | null = null;
  let swallowClick = false;

  function pressStart(event: PointerEvent): void {
    if (event.button !== 0) return;
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, down };
    swallowClick = false;
    // Capture keeps the moves coming when the pointer is over the game's frame, which would otherwise take them.
    try {
      tab?.setPointerCapture(event.pointerId);
    } catch {
      // The drag still works while the pointer stays over the page.
    }
  }

  function pressMove(event: PointerEvent): void {
    if (press === null || event.pointerId !== press.id) return;
    const dx = event.clientX - press.x;
    const dy = event.clientY - press.y;
    if (!dragging && Math.hypot(dx, dy) < DRAG_PX) return;
    dragging = true;
    down = clampDown(press.down + dy / window.innerHeight);
    // Past the middle of the window it belongs to the other edge.
    edge = event.clientX < window.innerWidth / 2 ? "left" : "right";
  }

  function pressEnd(event: PointerEvent, cancelled: boolean): void {
    if (press === null || event.pointerId !== press.id) return;
    press = null;
    if (!dragging) return;
    dragging = false;
    swallowClick = !cancelled;
    keepPlace();
  }

  function tabKey(event: KeyboardEvent): void {
    swallowClick = false;
    const step = NUDGE_PX / window.innerHeight;
    if (event.key === "ArrowUp") down = clampDown(down - step);
    else if (event.key === "ArrowDown") down = clampDown(down + step);
    else if (event.key === "ArrowLeft") edge = "left";
    else if (event.key === "ArrowRight") edge = "right";
    else return;
    // The arrow keys would otherwise scroll the page.
    event.preventDefault();
    keepPlace();
  }

  function tabClicked(): void {
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    openMenu();
  }

  function openMenu(): void {
    noFullscreen = false;
    menu?.showModal();
    menuOpen = true;
  }

  /** Back to game: the menu closes, and the game is one tap away. */
  function closeMenu(): void {
    menu?.close();
  }

  // Closing the menu does not put the game in focus: play time starts only when the person touches the game, and
  // the browser hands the focus back to the tab, where it was before the menu opened.
  function menuClosed(): void {
    menuOpen = false;
  }

  // A press on the dim strip of game beside the menu closes it; the press does not reach the game.
  function menuPressed(event: MouseEvent): void {
    if (event.target === menu) closeMenu();
  }

  async function toggleFullscreen(): Promise<void> {
    if (!document.fullscreenEnabled) {
      noFullscreen = true;
      return;
    }
    try {
      if (document.fullscreenElement === null) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
      closeMenu();
    } catch {
      noFullscreen = true;
    }
  }

  function askToExit(): void {
    exit?.showModal();
  }

  function stayInGame(): void {
    exit?.close();
    closeMenu();
  }

  // Play time: one look a second, and one at once when the tab is hidden or shown; a beat every BEAT_EVERY_MS; one last
  // beat as the page closes. A beat the server did not take (offline for a moment) is spoken for by the next one.
  onMount(() => {
    const attention = createAttention();
    const beatAt = `/g/${data.slug}/play/beat`;
    const body = () =>
      JSON.stringify({ session: data.session.id, token: data.session.token, attentive: attention.report() });

    function look(): void {
      const box = frame?.getBoundingClientRect();
      attention.look({
        tabShowing: document.visibilityState === "visible",
        frameOnScreen:
          box !== undefined &&
          box.width > 0 &&
          box.height > 0 &&
          box.bottom > 0 &&
          box.right > 0 &&
          box.top < window.innerHeight &&
          box.left < window.innerWidth,
        frameFocused: frame !== undefined && document.activeElement === frame && document.hasFocus(),
      });
    }

    let over = false;
    async function beat(): Promise<void> {
      if (over) return;
      try {
        const answer = await fetch(beatAt, { method: "POST", body: body(), keepalive: true });
        if (answer.status === 204) attention.taken();
        // The session has ended or is not known: no beat will ever be taken again.
        if (answer.status === 410 || answer.status === 404) over = true;
      } catch {
        // Offline for a moment: the next beat speaks for this stretch too.
      }
    }

    const looking = setInterval(look, 1_000);
    const beating = setInterval(() => void beat(), BEAT_EVERY_MS);
    const onVisibility = () => {
      look();
    };
    // Leaving sends the stretch since the last beat, once. It happens on `pagehide` (the tab closes, the address
    // changes) and when Exit game takes the person back inside the site, which never fires `pagehide`. It does not
    // look first: by then opening the menu has moved the focus off the game, and that is not looking away.
    let left = false;
    const leave = () => {
      if (left || over) return;
      left = true;
      navigator.sendBeacon(beatAt, body());
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", leave);
    return () => {
      clearInterval(looking);
      clearInterval(beating);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  });
</script>

<svelte:head>
  <title>{data.name} · Ruken</title>
</svelte:head>

<main class="stage">
  {#if src !== undefined}
    <iframe
      bind:this={frame}
      class="frame"
      title={data.name}
      {src}
      sandbox={data.frame.sandbox}
      allow={data.frame.allow}
      referrerpolicy="no-referrer"
      onload={loaded}
    ></iframe>
  {/if}

  {#if !ready}
    <section class="cover" aria-busy="true">
      <h1>Getting {data.name} ready.</h1>
      <!-- A progress bar with no value is how a page says "busy, no amount yet". -->
      <div class="meter" role="progressbar" aria-label="Loading the game"><div></div></div>
      {#if slow}
        <p role="status">Still working. The first time can take a little longer.</p>
      {/if}
      <p><a href={`/g/${data.slug}`}>Go back</a></p>
    </section>
  {/if}

  <button
    bind:this={tab}
    class="tab"
    type="button"
    aria-label="Ruken menu"
    aria-haspopup="dialog"
    aria-expanded={menuOpen}
    data-edge={edge}
    data-resting={resting ? "" : undefined}
    onclick={tabClicked}
    onkeydown={tabKey}
    onpointerdown={pressStart}
    onpointermove={pressMove}
    onpointerup={(event) => {
      pressEnd(event, false);
    }}
    onpointercancel={(event) => {
      pressEnd(event, true);
    }}
    onlostpointercapture={(event) => {
      pressEnd(event, true);
    }}
    onpointerenter={() => (hovered = true)}
    onpointerleave={() => (hovered = false)}
    onfocus={() => (focused = true)}
    onblur={() => (focused = false)}
  >
    <span aria-hidden="true">R</span>
    <span class="chevron" aria-hidden="true"></span>
  </button>

  <!-- The Ruken menu. A dialog the browser keeps the keyboard in; Escape is Back to game. -->
  <dialog
    bind:this={menu}
    class="drawer"
    aria-label="Ruken menu"
    data-edge={edge}
    onclose={menuClosed}
    onclick={menuPressed}
  >
    <h2>{data.name}</h2>
    <p><button type="button" onclick={closeMenu}>Back to game</button></p>
    <p>
      <button type="button" class="safe" aria-pressed={fullscreen} onclick={() => void toggleFullscreen()}>
        {fullscreen ? "Minimize" : "Fullscreen"}
      </button>
    </p>
    {#if noFullscreen}
      <p role="status">
        Fullscreen isn't available in this browser. Add Ruken to your Home Screen to play fullscreen.
      </p>
    {/if}
    <dl>
      <dt>Connection</dt>
      <dd>{online ? "Connected" : "Ruken can't reach the internet."}</dd>
    </dl>
    <p><button type="button" class="quiet" onclick={askToExit}>Exit game</button></p>
  </dialog>

  <dialog bind:this={exit} class="exit" aria-labelledby="exit-title">
    <h2 id="exit-title">Exit {data.name}?</h2>
    <p>You'll go back to the game page.</p>
    <p>
      <button type="button" class="safe" onclick={stayInGame}>Stay in game</button>
      <a class="button" href={`/g/${data.slug}`}>Exit game</a>
    </p>
  </dialog>
</main>
