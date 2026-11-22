<!--
  The feed (spec 5.1): one game to a screen, full-window clips that snap one at a time. Each clip leads with the person
  who made it, then the game and Play. A press on the clip flips sound for every clip; Share is the one mark on the
  right. It reads without script: every clip is a plain video, every name and Play a plain link, and swiping scrolls.
  With script it fetches only the clip on screen and the next, plays the one on screen where a video may move, shows
  the window's shape of clip, and moves a clip at a time on the arrow keys, Page Up, Page Down and Space.
-->
<script lang="ts">
  import { loads } from "../../lib/loads.ts";
  import { onMount, tick } from "svelte";
  import { mayMove } from "../../lib/quiet-video.ts";
  import { clampClip, currentOf, stepFor } from "./current.ts";
  import { shareLink, type ShareTools } from "./share.ts";
  import type { FeedClip } from "./service.ts";

  let { clips }: { clips: FeedClip[] } = $props();

  /** Where a first open's hints are remembered, so they show once on a device and never again. */
  const SEEN_HINTS = "rk_seen_hints";
  /** How long "Link copied." stays. */
  const NOTE_MS = 4000;

  let feed = $state<HTMLElement>();
  let sections = $state<HTMLElement[]>([]);
  let videos = $state<(HTMLVideoElement | undefined)[]>([]);
  // Whether the script has started. Before it, every clip is the upright one and none is fetched until the window's
  // shape is known, so a wide window never fetches a clip it will not show.
  let ready = $state(false);
  // Whether clips may start fetching. It follows `ready` by one update, so the clip's address is already the window's
  // shape when its preload changes, and no clip is fetched in the wrong shape first.
  let warm = $state(false);
  let shape = $state<"upright" | "wide">("upright");
  let current = $state(0);
  let soundOn = $state(false);
  // The clips a press has started, for a device that does not play a video by itself.
  let started = $state<string[]>([]);
  let autoplay = $state(false);
  let hint = $state<"touch" | "pointer" | null>(null);
  let note = $state<{ slug: string; words: string } | null>(null);
  let noteTimer: ReturnType<typeof setTimeout> | undefined;

  const initialOf = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? "";
  const clipAddress = (clip: FeedClip): string =>
    `${ready && shape === "wide" ? clip.wide : clip.upright}#t=0.001`;
  // The clip on screen and the next are fetched; every other clip waits until a person is close.
  // A clip has no address at all until it is the one on screen or the next: WebKit fetches a clip that has an address
  // whatever its preload says, which would fetch the whole feed on the first open.
  const fetches = (index: number): boolean => warm && index <= current + 1;
  const preloads = (index: number): "metadata" | "none" =>
    warm && index <= current + 1 ? "metadata" : "none";

  onMount(() => {
    autoplay = mayMove();
    const wide = matchMedia("(orientation: landscape)");
    shape = wide.matches ? "wide" : "upright";
    const follow = () => {
      shape = wide.matches ? "wide" : "upright";
    };
    wide.addEventListener("change", follow);

    // The first open's hints, once per device. A browser that will not keep a note shows them every time.
    let seen = false;
    try {
      seen = localStorage.getItem(SEEN_HINTS) !== null;
    } catch {
      // Private browsing: no memory, so no "never again".
    }
    if (!seen && clips.length > 0) hint = matchMedia("(pointer: coarse)").matches ? "touch" : "pointer";

    const ratios: (number | undefined)[] = [];
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios[sections.indexOf(entry.target as HTMLElement)] = entry.intersectionRatio;
        }
        current = currentOf(ratios) ?? current;
      },
      { root: feed ?? null, threshold: Array.from({ length: 21 }, (_, step) => step / 20) },
    );
    for (const section of sections) watcher.observe(section);

    ready = true;
    void tick().then(() => {
      warm = true;
    });
    return () => {
      wide.removeEventListener("change", follow);
      watcher.disconnect();
      clearTimeout(noteTimer);
    };
  });

  // The clip on screen plays (where a video may move, or once pressed), every other clip waits at its start, and sound is
  // one setting for all of them.
  $effect(() => {
    if (!warm) return;
    videos.forEach((video, index) => {
      if (video === undefined) return;
      video.muted = !soundOn;
      const slug = clips[index]?.slug ?? "";
      if (index === current && (autoplay || started.includes(slug))) {
        video
          .play()
          .then(() => {
            // The start finished after a person moved on: the clip that is not on screen waits at its start.
            if (index !== current) video.pause();
          })
          .catch(() => {
            // A person moved on while the clip was starting: that is our own pause cutting the start short, and the
            // clip must stay paused (a retry here would play a clip nobody is looking at).
            if (index !== current) return;
            // The browser would not play with sound: the quiet answer is to play without it, and the mark says so.
            if (soundOn) soundOn = false;
            video.muted = true;
            video.play().catch(() => undefined);
          });
      } else if (index !== current) {
        video.pause();
        if (video.currentTime > 0) video.currentTime = 0;
      }
    });
  });

  // A clip that starts while it is not the one on screen is stopped where it is. The feed never starts one, but Safari's
  // engine can: when the feed pauses the clip a person left and rewinds it, the engine may start it again once the rewind
  // lands (seen in the feed journey's log: a "play" with no call from the page, 16 ms after the pause). It is only paused
  // here, not rewound again, so a rewind cannot start it a second time.
  function stopIfOffScreen(index: number): void {
    if (index !== current) videos[index]?.pause();
  }

  function forgetHints(): void {
    if (hint === null) return;
    hint = null;
    try {
      localStorage.setItem(SEEN_HINTS, "1");
    } catch {
      // Nothing to keep it in.
    }
  }

  function pressClip(slug: string): void {
    soundOn = !soundOn;
    if (!started.includes(slug)) started = [...started, slug];
    forgetHints();
  }

  function goTo(index: number): void {
    // With less motion the next clip is simply there, not slid to.
    sections[clampClip(index, clips.length)]?.scrollIntoView({
      behavior: mayMove() ? "smooth" : "auto",
      block: "start",
    });
  }

  function onKey(event: KeyboardEvent): void {
    forgetHints();
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const step = stepFor(event.key, event.shiftKey);
    if (step === 0) return;
    const target = event.target instanceof Element ? event.target : null;
    // A field keeps its keys. Space presses a focused link or button, so it moves the clip only from nothing in particular.
    if (target?.closest("input, textarea, select, [contenteditable]") != null) return;
    if (event.key === " " && target?.closest("a, button, summary") != null) return;
    event.preventDefault();
    goTo(current + step);
  }

  async function share(clip: FeedClip): Promise<void> {
    // A page that is not on https has no clipboard, and some browsers have no share sheet.
    const clipboard = (navigator as { clipboard?: Clipboard }).clipboard;
    const tools: ShareTools = {
      share: typeof navigator.share === "function" ? (data) => navigator.share(data) : undefined,
      copy: clipboard === undefined ? undefined : (text) => clipboard.writeText(text),
    };
    const result = await shareLink(tools, { title: clip.name, url: `${location.origin}/g/${clip.slug}` });
    if (result !== "copied" && result !== "manual") return;
    clearTimeout(noteTimer);
    note = {
      slug: clip.slug,
      words: result === "copied" ? "Link copied." : "Copy the address from the bar at the top.",
    };
    noteTimer = setTimeout(() => (note = null), NOTE_MS);
  }
</script>

<svelte:head>
  <title>Ruken</title>
</svelte:head>

<svelte:window onkeydown={onKey} onpointerdown={forgetHints} />

{#if clips.length === 0}
  <main class="empty">
    <p class="statement">No games here yet.</p>
  </main>
{:else}
  <main class="feed" data-ready={ready ? "true" : "false"} bind:this={feed} onscroll={forgetHints}>
    {#each clips as clip, index (clip.slug)}
      <section
        bind:this={sections[index]}
        data-slug={clip.slug}
        data-current={index === current ? "true" : "false"}
        aria-label={clip.name}
      >
        <video
          use:loads
          bind:this={videos[index]}
          onplay={() => {
            stopIfOffScreen(index);
          }}
          src={fetches(index) ? clipAddress(clip) : undefined}
          preload={preloads(index)}
          muted
          loop
          playsinline
          tabindex="-1"
          aria-hidden="true"
        ></video>
        <noscript>
          <video
            src={`${clip.upright}#t=0.001`}
            preload="none"
            muted
            loop
            playsinline
            tabindex="-1"
            aria-hidden="true"
          ></video>
        </noscript>
        <button
          type="button"
          class="sound"
          aria-label="Sound"
          aria-pressed={soundOn}
          onclick={() => {
            pressClip(clip.slug);
          }}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor" />
            {#if soundOn}
              <path
                d="M15 9a4 4 0 0 1 0 6M17.5 6.5a8 8 0 0 1 0 11"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            {:else}
              <path
                d="M16 9l5 6M21 9l-5 6"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            {/if}
          </svg>
        </button>

        {#if index === 0 && hint !== null}
          <div class="hints">
            <p>{hint === "touch" ? "Swipe up for the next game" : "Scroll down for the next game"}</p>
            <p>{hint === "touch" ? "Tap for sound" : "Click for sound"}</p>
          </div>
        {/if}

        <div class="lower">
          <div class="band">
            {#if clip.maker !== null}
              <a class="maker" data-sveltekit-preload-data="off" href={`/${clip.maker.handle}`}>
                {#if clip.maker.photo !== null}
                  <img use:loads src={clip.maker.photo} alt="" width="40" height="40" loading="lazy" />
                {:else}
                  <span class="initial" aria-hidden="true">{initialOf(clip.maker.name)}</span>
                {/if}
                <span class="makername">{clip.maker.name}</span>
              </a>
            {/if}
            <a class="gamelink" href={`/g/${clip.slug}`}>
              <h2>{clip.name}</h2>
              <p>{clip.oneLine}</p>
            </a>
            <a class="button play" href={`/g/${clip.slug}/play`}>Play</a>
          </div>
          <div class="side">
            <p class="sharenote" role="status">{note?.slug === clip.slug ? note.words : ""}</p>
            <button
              type="button"
              class="share"
              aria-label="Share"
              onclick={() => {
                void share(clip);
              }}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M3 11l18-8-8 18-2-8-8-2z" fill="currentColor" />
              </svg>
            </button>
          </div>
        </div>
      </section>
    {/each}
  </main>
{/if}

<style>
  .feed {
    position: fixed;
    inset: 0;
    width: auto;
    margin: 0;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    overscroll-behavior: contain;
    background: var(--felt-deep);
  }
  .empty {
    display: grid;
    place-items: center;
    width: auto;
    min-height: 100dvh;
    margin: 0;
    padding: 1rem 1rem 6rem;
    text-align: center;
  }
  .empty p {
    margin: 0;
  }
  section {
    position: relative;
    height: 100dvh;
    overflow: hidden;
    scroll-snap-align: start;
    scroll-snap-stop: always;
    background: var(--felt-deep);
  }
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--felt-deep);
  }
  /* The whole clip is one button: a press anywhere on it that is not a link or a mark flips sound. The speaker mark in its
     corner shows which it is. */
  .sound {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: block;
    width: 100%;
    min-height: 0;
    padding: 0;
    border-radius: 0;
    background: none;
    color: var(--chalk);
    text-align: start;
  }
  .sound svg {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    box-sizing: content-box;
    padding: 10px;
    border-radius: 50%;
    background: var(--felt-deep);
    opacity: 0.8;
  }
  .sound:focus-visible,
  .share:focus-visible {
    outline-offset: -6px;
  }
  .hints {
    position: absolute;
    top: 38%;
    left: 50%;
    z-index: 2;
    translate: -50% 0;
    width: max-content;
    max-width: calc(100% - 2rem);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-button);
    background: var(--felt-deep);
    color: var(--chalk);
    text-align: center;
    pointer-events: none;
  }
  .hints p {
    margin: 0;
  }
  .hints p + p {
    margin-top: 0.25rem;
    font: var(--text-small);
  }
  /* The words and Play, at the bottom left, with Share at the right. The bar floats under them. */
  .lower {
    position: absolute;
    inset: auto 0 5.25rem;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0 0.75rem;
    pointer-events: none;
  }
  .band {
    position: relative;
    isolation: isolate;
    flex: 0 1 30rem;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: var(--radius-button);
    color: var(--chalk);
  }
  /* A flat band of ink at 60%: chalk on it is 4.5 to 1 or more over even a white clip. */
  .band::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: var(--ink);
    opacity: 0.6;
  }
  .band a,
  .side button {
    pointer-events: auto;
  }
  .maker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-height: var(--size-target);
    margin: 0;
    text-decoration: none;
  }
  .maker img,
  .initial {
    flex: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
  }
  .initial {
    display: grid;
    place-items: center;
    background: var(--paper);
    color: var(--ink);
    font-weight: 600;
  }
  .makername {
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: 600;
  }
  .gamelink {
    display: block;
    min-height: var(--size-target);
    margin: 0;
    text-decoration: none;
  }
  .gamelink h2 {
    margin: 0;
    font: var(--text-statement);
    overflow-wrap: anywhere;
  }
  .gamelink p {
    margin: 0.25rem 0 0;
    overflow-wrap: anywhere;
  }
  .play {
    width: 100%;
    margin: 0;
  }
  .side {
    position: relative;
    flex: none;
  }
  .share {
    display: grid;
    place-items: center;
    width: var(--size-target);
    min-height: var(--size-target);
    padding: 0;
    border-radius: 50%;
    background: var(--felt-deep);
    color: var(--chalk);
  }
  .sharenote {
    position: absolute;
    right: 0;
    bottom: calc(100% + 0.5rem);
    width: max-content;
    max-width: 14rem;
    margin: 0;
    padding: 0;
    border-radius: var(--radius-button);
    background: var(--felt-deep);
    color: var(--chalk);
    font: var(--text-small);
    text-align: end;
    pointer-events: none;
  }
  .sharenote:not(:empty) {
    padding: 0.5rem 0.75rem;
  }
  .maker:focus-visible,
  .gamelink:focus-visible,
  .play:focus-visible {
    outline-color: var(--chalk);
  }
</style>
