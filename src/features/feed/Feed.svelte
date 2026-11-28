<!--
  The feed (spec 5.1): one game to a screen, full-window clips that snap one at a time. Each clip shows the game and
  Play at the bottom, and the person who made it at the top of the column on the right, with a plus to follow them, above
  Share (Ruken's own share sheet). A press on the clip opens the game's page; the speaker in the corner flips sound for
  every clip. The top bar (FeedTop.svelte) holds the Fresh and Followed tabs and Search. It reads without script: every
  clip is a plain video, every name and Play a plain link, and swiping scrolls.
  With script it fetches only the clip on screen and the next, plays the one on screen where a video may move, shows
  the window's shape of clip, and moves a clip at a time on the arrow keys, Page Up, Page Down and Space.
  The feed never ends: a few clips before the end of what it has, it asks for the next page, and a spinner fills the
  screen past the last clip until that page comes. When every game has been shown it goes round again in a new order.
-->
<script lang="ts">
  import MovingBehind from "../../lib/moving-behind.svelte";
  import { askForYes, deviceStore, hasAgreed } from "../consent/consent.browser.ts";
  import { goto } from "$app/navigation";
  import { loads } from "../../lib/loads.ts";
  import { onMount, tick } from "svelte";
  import { snapshot } from "$app/navigation";
  import { loopByHand, mayMove } from "../../lib/quiet-video.ts";
  import { stillPoster } from "../../lib/still-poster.ts";
  import { clampClip, currentOf, stepFor } from "./current.ts";
  import GoodPick from "./GoodPick.svelte";
  import FeedTop from "./FeedTop.svelte";
  import FollowBadge from "./FollowBadge.svelte";
  import ShareSheet from "./ShareSheet.svelte";
  import TasteSheet from "./TasteSheet.svelte";
  import type { ShareSheetControl } from "./share.ts";
  import type { FeedClip, FeedPage } from "./service.ts";
  import type { ClipMarks, MarkKind } from "./marks.ts";
  import type { TabKey } from "./tabs.ts";
  import type { Friend } from "../sends/sends.browser.ts";
  import { WishlistButton } from "../launch/launch.browser.ts";

  let {
    first,
    launch,
    tab = "fresh",
    tune = false,
    news = false,
    friends = null,
  }: {
    first: FeedPage;
    /** Which of the top bar's tabs this is: every game, or the makers the person follows (Followed.svelte). */
    tab?: TabKey;
    /** Whether friends sent games the person has not looked at: the dot on the Your turn tab. */
    news?: boolean;
    /** The person's friends, for Your turn in the share sheet; null when signed out. */
    friends?: readonly Friend[] | null;
    /** Whether this person's feed is learning from them, so each clip offers More and Less like this (•••). */
    tune?: boolean;
    /** Before launch: Wishlist where Play goes, the day it opens and the person's whole list (so later pages too). */
    launch: { before: false } | { before: true; opens: string; wished: string[] };
  } = $props();

  /** How many clips before the end of what the feed has it asks for the next page, so a person rarely meets the spinner. */
  const ASK_AHEAD = 3;

  // The feed starts from its first page; the route makes a new feed for a new first page.
  // svelte-ignore state_referenced_locally
  let clips = $state<FeedClip[]>(first.clips);
  // svelte-ignore state_referenced_locally
  let next = $state<string | null>(first.next);
  let more = $state<"idle" | "loading" | "failed">("idle");

  /** Where a first open's hints are remembered, so they show once on a device and never again. */
  const SEEN_HINTS = "rk_seen_hints";

  let feed = $state<HTMLElement>();
  // An element bound here is null once it has gone (a clip put back from Back, or the spinner screen when no page is
  // left), not undefined, so every use checks for both.
  let sections = $state<(HTMLElement | null | undefined)[]>([]);
  let videos = $state<(HTMLVideoElement | null | undefined)[]>([]);
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
  let watcher = $state.raw<IntersectionObserver>();
  // The screen past the last clip, while there is a next page: the spinner, or "Try again".
  let moreScreen = $state<HTMLElement | null>();
  // One share sheet for the whole feed; each clip's Share opens it for that game.
  let shareSheet = $state<ShareSheetControl>();
  // One ••• sheet too, and "Got it." for two seconds after a press on it.
  // The ••• sheet opens the same way the Share sheet does.
  let tasteSheet = $state<ShareSheetControl>();
  let gotIt = $state(false);
  let gotItTimer: ReturnType<typeof setTimeout> | undefined;
  // The Good pick cards still to answer, by the key of the clip each sits on.
  // svelte-ignore state_referenced_locally
  let asks = $state<Partial<Record<string, { slug: string; name: string }>>>(
    first.ask ? { [first.ask.key]: first.ask } : {},
  );

  // The clips "You're all caught up" goes on, by key: where each page said the person had seen everything new.
  // svelte-ignore state_referenced_locally
  let caughtUp = $state<string[]>(first.caughtUp === undefined ? [] : [first.caughtUp]);

  function sayGotIt(): void {
    gotIt = true;
    clearTimeout(gotItTimer);
    gotItTimer = setTimeout(() => {
      gotIt = false;
    }, 2000);
  }

  // An answered card goes, and the feed moves on to the next clip.
  function answered(key: string, index: number): void {
    asks = Object.fromEntries(Object.entries(asks).filter(([other]) => other !== key));
    goTo(index + 1);
  }
  // A press on one clip's plus changes every clip by that maker, on this page and on pages still to come.
  let followed = $state<Record<string, boolean>>({});

  // What a press changed, by game: a game can be on the feed twice, and both of its clips show the same marks.
  let pressed = $state<Record<string, ClipMarks>>({});
  // The marks being sent, as "slug kind", so a second press waits for the first to come back.
  let sendingMarks = $state<string[]>([]);
  // The game whose press failed, for the line under its buttons.
  let markProblem = $state<string | null>(null);
  const marksOf = (clip: FeedClip): ClipMarks => pressed[clip.slug] ?? clip.marks;
  const FIELD: Record<MarkKind, "liked" | "saved" | "reposted"> = {
    like: "liked",
    save: "saved",
    repost: "reposted",
  };

  // A press shows its answer at once and is sent behind it, so a like never waits; if the site says no, the button goes
  // back and the clip says so. Without the cookie yes the person is asked first, in place (the card says what for), and
  // signed out they sign in and the press is made on the way back (pressed.ts).
  async function press(clip: FeedClip, kind: MarkKind): Promise<void> {
    const busyKey = `${clip.slug} ${kind}`;
    if (sendingMarks.includes(busyKey)) return;
    forgetHints();
    if (!hasAgreed()) {
      // The card asks in place and, on "I agree", this same press goes on (consent/ask.svelte.ts).
      askForYes(kind, () => void press(clip, kind));
      return;
    }
    const before = marksOf(clip);
    const on = !before[FIELD[kind]];
    const likes = kind === "like" ? before.likes + (on ? 1 : -1) : before.likes;
    pressed[clip.slug] = { ...before, [FIELD[kind]]: on, likes: Math.max(0, likes) };
    sendingMarks = [...sendingMarks, busyKey];
    markProblem = null;
    try {
      const answer = await fetch("/api/feed/marks", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ game: clip.slug, kind, on }),
      });
      if (answer.status === 401) {
        // Signed out: sign in, and the press is made on the way back.
        pressed[clip.slug] = before;
        const said = await answer.json<{ go?: string }>().catch(() => ({ go: undefined }));
        await goto(said.go ?? `/sign-in?next=${encodeURIComponent("/")}`);
        return;
      }
      if (!answer.ok) throw new Error(`the site answered ${String(answer.status)}`);
      const said = await answer.json<{ on: boolean; likes: number }>();
      pressed[clip.slug] = { ...marksOf(clip), [FIELD[kind]]: said.on, likes: said.likes };
    } catch {
      pressed[clip.slug] = { ...marksOf(clip), [FIELD[kind]]: before[FIELD[kind]], likes: before.likes };
      markProblem = clip.slug;
    } finally {
      sendingMarks = sendingMarks.filter((one) => one !== busyKey);
    }
  }

  const initialOf = (name: string): string => Array.from(name.trim())[0]?.toUpperCase() ?? "";

  /** What the friends' faces on a clip say to a screen reader: who liked it, and how many more. */
  function friendsWords(friends: FeedClip["friends"]): string {
    const names = friends.faces.map((face) => face.name);
    if (friends.more > 0) names.push(`${String(friends.more)} more`);
    const last = names.pop() ?? "";
    const list = names.length === 0 ? last : `${names.join(", ")} and ${last}`;
    return `Liked by your ${friends.faces.length + friends.more === 1 ? "friend" : "friends"} ${list}`;
  }
  const clipAddress = (clip: FeedClip): string =>
    `${ready && shape === "wide" ? clip.wide : clip.upright}#t=0.001`;
  // The clip on screen, the one before and the next are fetched; every other clip waits until a person is close.
  // A clip has no address at all unless it is one of those three: WebKit fetches a clip that has an address whatever its
  // preload says, which would fetch the whole feed on the first open, and a feed that never ends must not keep every clip
  // a person has passed.
  const near = (index: number): boolean => warm && index >= current - 1 && index <= current + 1;
  const fetches = near;
  // A clip's still is fetched a little further ahead than its video, so it is there before the video starts to come:
  // three clips on, a picture of a few dozen kilobytes each, and never the whole feed.
  const stillNear = (index: number): boolean => warm && index >= current - 1 && index <= current + 3;
  const preloads = (index: number): "metadata" | "none" => (near(index) ? "metadata" : "none");

  onMount(() => {
    autoplay = mayMove();
    const wide = matchMedia("(orientation: landscape)");
    shape = wide.matches ? "wide" : "upright";
    const follow = () => {
      shape = wide.matches ? "wide" : "upright";
    };
    wide.addEventListener("change", follow);

    // Turning a phone (or any change to the window's size) changes every clip's height, so the feed's scroll offset now
    // points somewhere else: near the end of what the feed has, past the last clip, at the screen that waits for the next
    // page. Safari's engine does not always bring the person's clip back, and if that page then comes in while the
    // waiting screen looks to be on screen, the feed moves the person on to its first clip. So the clip the person was
    // on is put back here. The resize event runs before the browser works out what is on screen, so `current` is still
    // that clip and the watcher never sees the in-between place. Only a change of width counts: a phone's browser bars
    // grow and shrink the height in the middle of a swipe, and putting the clip back then would undo the swipe.
    let width = window.innerWidth;
    const keepPlace = () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      const place = current >= clips.length ? moreScreen : sections[current];
      place?.scrollIntoView({ behavior: "instant", block: "start" });
    };
    window.addEventListener("resize", keepPlace);

    // The first open's hints, once per device. A browser that has not said yes to cookies, or will not keep a note,
    // shows them again on the next visit (the device store keeps the note for this visit only).
    const seen = deviceStore.get(SEEN_HINTS) !== null;
    if (!seen && clips.length > 0) hint = matchMedia("(pointer: coarse)").matches ? "touch" : "pointer";

    // How much of each screen is in the window. The screen past the last clip counts as one after it, so a fast swipe
    // straight to the spinner is "near the end" and asks for the next page, and no clip plays behind the spinner.
    const ratios = new WeakMap<Element, number>();
    watcher = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) ratios.set(entry.target, entry.intersectionRatio);
        // `sections` can be longer than the clips after a restore put back fewer clips: the slots past them are gone.
        const screens = [...sections.slice(0, clips.length), moreScreen];
        current = currentOf(screens.map((screen) => (screen ? ratios.get(screen) : undefined))) ?? current;
      },
      { root: feed ?? null, threshold: Array.from({ length: 21 }, (_, step) => step / 20) },
    );

    ready = true;
    mounted = true;
    if (returning !== undefined) returnTo(returning);
    else {
      // Back from a press that waited (the cookie yes, sign-in): the feed opens at that game's clip.
      const at = new URL(location.href).searchParams.get("at");
      const index = at === null ? -1 : clips.findIndex((clip) => clip.slug === at);
      if (index > 0) {
        current = index;
        void tick().then(() => sections[index]?.scrollIntoView({ behavior: "instant", block: "start" }));
      }
    }
    void tick().then(() => {
      warm = true;
    });
    return () => {
      wide.removeEventListener("change", follow);
      window.removeEventListener("resize", keepPlace);
      watcher?.disconnect();
      clearTimeout(slideTimer);
      clearTimeout(gotItTimer);
    };
  });

  // Every clip is watched for how much of it is in the window, the ones a later page adds as well. Watching one twice
  // does nothing, so all of them are handed over each time.
  $effect(() => {
    if (watcher === undefined) return;
    for (const section of [...sections, moreScreen]) if (section) watcher.observe(section);
  });

  // A few clips before the end of what the feed has, it asks for the next page. A page that failed waits for "Try again".
  $effect(() => {
    if (warm && next !== null && more === "idle" && current >= clips.length - ASK_AHEAD) void loadMore();
  });

  async function loadMore(): Promise<void> {
    if (next === null) return;
    more = "loading";
    try {
      const response = await fetch(`/api/feed?after=${encodeURIComponent(next)}`);
      if (!response.ok) throw new Error(`the feed's next page answered ${String(response.status)}`);
      const page = await response.json<FeedPage>();
      const have = new Set(clips.map((clip) => clip.key));
      const had = clips.length;
      // Whether the person is on the spinner. The browser keeps a snapped screen in view when what is above it grows, so
      // without a move they would stay on the spinner as it went down the page, and it would ask again and again.
      const waiting = current >= had;
      clips = [...clips, ...page.clips.filter((clip) => !have.has(clip.key))];
      if (page.ask) asks = { ...asks, [page.ask.key]: page.ask };
      if (page.caughtUp !== undefined) caughtUp = [...caughtUp, page.caughtUp];
      next = page.next;
      more = "idle";
      if (waiting) {
        await tick();
        sections[had]?.scrollIntoView({ block: "start" });
      }
    } catch {
      more = "failed";
    }
  }

  // A clip that is no longer near lets go of its video. Taking its address away is not enough: a video keeps what it
  // fetched until it is told to load again, with no address, which empties it.
  $effect(() => {
    videos.forEach((video, index) => {
      if (!video || fetches(index)) return;
      // Already let go: no address and nothing held. (`currentSrc` keeps the old address after this in Chromium.)
      if (!video.hasAttribute("src") && video.networkState === HTMLMediaElement.NETWORK_EMPTY) return;
      // The address is taken off here too, not left to the screen's own update, so the load below never fetches it again.
      video.removeAttribute("src");
      video.load();
    });
  });

  // The clip on screen plays (where a video may move, or once pressed), every other clip waits at its start, and sound is
  // one setting for all of them.
  $effect(() => {
    if (!warm) return;
    videos.forEach((video, index) => {
      if (!video) return;
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
    deviceStore.set(SEEN_HINTS, "1");
  }

  function pressSound(slug: string): void {
    soundOn = !soundOn;
    if (!started.includes(slug)) started = [...started, slug];
    forgetHints();
  }

  // The feed scrolls inside itself, which the browser's own Back does not keep, so where a person was is kept as the
  // page's snapshot and put back at once when they come back to it. The feed goes round and a game can be on it twice,
  // so the snapshot keeps every clip the feed had (later pages too) and the place by its key, not by the game. A place on
  // the first page is found in the first page the page came with, which is fresh: a game that went live or came off since
  // shows as it is now, and a place on a game that came off starts from the top. Only a place on a later page puts back
  // the kept clips.
  interface Place {
    clips: FeedClip[];
    next: string | null;
    key: string;
    /** How many of the kept clips were the first page. */
    firstCount: number;
  }
  let mounted = false;
  let returning: Place | undefined;
  // svelte-ignore state_referenced_locally
  let firstCount = first.clips.length;
  function returnTo(place: Place): void {
    if (place.clips.findIndex((clip) => clip.key === place.key) >= place.firstCount) {
      clips = place.clips;
      next = place.next;
      firstCount = place.firstCount;
    }
    void tick().then(() => {
      const index = clips.findIndex((clip) => clip.key === place.key);
      if (index <= 0) return;
      current = index;
      sections[index]?.scrollIntoView({ behavior: "auto", block: "start" });
    });
  }
  snapshot<Place | undefined>({
    capture: () => {
      const key = clips[current]?.key;
      return key === undefined ? undefined : { clips, next, key, firstCount };
    },
    restore: (place) => {
      if (place === undefined) return;
      if (mounted) returnTo(place);
      else returning = place;
    },
  });

  /** The screen a step lands on: a clip, or past the last one the screen that waits for the next page. */
  function screenAt(index: number): { index: number; screen: HTMLElement | null | undefined } {
    if (index >= clips.length && moreScreen) return { index: clips.length, screen: moreScreen };
    const clip = clampClip(index, clips.length);
    return { index: clip, screen: sections[clip] };
  }

  // Where the keys are sending the feed while it slides there, and whether it is still sliding. A key counts from where
  // the last key was going, not from the clip on screen, so two quick presses move two clips. And a key that comes
  // while the feed slides waits for the slide to end: Safari's engine can drop a slide begun in the middle of another
  // (the feed journey lost a key that came in a slide's last few pixels on a busy machine, twice in CI). Both need the
  // browser to say when a slide ends (`scrollend`); one that cannot keeps the old way, each key from the clip on screen.
  const tellsSlideEnd = typeof window !== "undefined" && "onscrollend" in window;
  let aim: number | null = null;
  let sliding = false;
  // A slide that started but never ends (one that could not move, or one Safari's engine sends no `scrollend` for) must
  // not hold the keys: after this long the feed stops waiting and moves one clip from the one on screen toward where the
  // keys were sending it, so a key that waited is never dropped and keys held by a stuck slide never jump the feed
  // several clips at once. A slide on a busy CI runner took about 0.8 s, so this never cuts a real one short.
  const SLIDE_GIVE_UP_MS = 2000;
  let slideTimer: ReturnType<typeof setTimeout> | undefined;

  function goTo(index: number): void {
    const { index: landing, screen } = screenAt(index);
    if (!screen || !feed) return;
    if (tellsSlideEnd) aim = landing;
    if (sliding) return;
    const away = screen.getBoundingClientRect().top - feed.getBoundingClientRect().top;
    // Already there: nothing slides, so no end will come.
    if (Math.abs(away) < 1) {
      aim = null;
      return;
    }
    sliding = tellsSlideEnd;
    clearTimeout(slideTimer);
    if (sliding) slideTimer = setTimeout(stopWaiting, SLIDE_GIVE_UP_MS);
    // With less motion the next clip is simply there, not slid to.
    screen.scrollIntoView({ behavior: mayMove() ? "smooth" : "auto", block: "start" });
  }

  // A slide has ended. If the keys were sending the feed further (or the slide was dropped), it goes on from here.
  function slideEnded(): void {
    clearTimeout(slideTimer);
    sliding = false;
    if (aim !== null) goTo(aim);
  }

  // A slide never said it ended: one step toward where the keys were going, counted from the clip on screen.
  function stopWaiting(): void {
    const going = aim;
    forgetAim();
    if (going !== null && going !== current) goTo(current + Math.sign(going - current));
  }

  // A finger or wheel takes the feed over: where the keys were going no longer counts.
  function forgetAim(): void {
    clearTimeout(slideTimer);
    aim = null;
    sliding = false;
  }

  /** The keys a browser scrolls a page with. */
  const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);

  /**
   * The control a shortcut presses on the clip on screen (the owner, 2026-11-22): Enter plays (or wishlists, before
   * launch), I opens the game's page, M turns the sound on or off, R reposts. Pressing the control itself means a key
   * does exactly what a tap does, sign-in and the cookie yes included.
   */
  function shortcutOf(key: string): HTMLElement | null {
    const clip = sections[current] ?? undefined;
    const pick = (where: Element | Document | undefined, selector: string) =>
      where?.querySelector<HTMLElement>(selector) ?? null;
    if (key === "Enter") return pick(clip, ".band .play");
    if (key === "i" || key === "I") return pick(clip, ".gamelink");
    if (key === "r" || key === "R") return pick(clip, 'button[aria-label="Repost"]');
    if (key === "m" || key === "M") return pick(document, "button.sound");
    return null;
  }

  function onKey(event: KeyboardEvent): void {
    forgetHints();
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target instanceof Element ? event.target : null;
    // While the Share sheet is open the feed behind it stays where it is, wherever the focus is: a button inside
    // a sheet can go away as the sheet changes what it shows, and the focus then falls to the page. A key inside the
    // sheet keeps its own job there; a key aimed at the page is stopped too, or the browser scrolls the feed itself.
    const sheet = document.querySelector("dialog[open]");
    if (sheet !== null) {
      if (SCROLL_KEYS.has(event.key) && (target === null || !sheet.contains(target))) event.preventDefault();
      return;
    }
    const control = shortcutOf(event.key);
    if (control !== null) {
      // A field keeps its letters, and a focused link or button keeps Enter for itself.
      if (target?.closest("input, textarea, select, [contenteditable]") != null) return;
      if (event.key === "Enter" && target?.closest("a, button, summary") != null) return;
      event.preventDefault();
      // A key held down repeats; one hold is one press, or a held M flips the sound back and forth.
      if (!event.repeat) control.click();
      return;
    }
    const step = stepFor(event.key, event.shiftKey);
    // With no clips there is nothing to move to, so up and down are the screen's own: the pad goes to the cookie card.
    if (step === 0 || clips.length === 0) return;
    // A field keeps its keys. Space presses a focused link or button, so it moves the clip only from nothing in particular.
    if (target?.closest("input, textarea, select, [contenteditable]") != null) return;
    if (event.key === " " && target?.closest("a, button, summary") != null) return;
    event.preventDefault();
    goTo((aim ?? current) + step);
  }
</script>

<svelte:window onkeydown={onKey} onpointerdown={forgetHints} />

<!-- One speaker for the whole feed, in the top bar beside the tabs and Search, so it stays put as the clips move under
     it (the owner, 2026-11-27: "they need to be grouped together as a unit"). -->
{#snippet speaker()}
  <button
    type="button"
    class="sound"
    aria-label="Sound"
    aria-pressed={soundOn}
    onclick={() => {
      pressSound(clips[current]?.slug ?? "");
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
{/snippet}

<FeedTop on={tab} {news} sound={clips.length > 0 ? speaker : undefined} />

{#if clips.length === 0}
  <main class="empty">
    <p class="statement">No games here yet.</p>
  </main>
{:else}
  <main
    class="feed"
    data-pad="line"
    data-ready={ready ? "true" : "false"}
    bind:this={feed}
    onscroll={forgetHints}
    onscrollend={slideEnded}
    onwheel={forgetAim}
    ontouchstart={forgetAim}
    onpointerdown={forgetAim}
  >
    <MovingBehind />
    {#each clips as clip, index (clip.key)}
      <section
        bind:this={sections[index]}
        data-slug={clip.slug}
        data-current={index === current ? "true" : "false"}
        aria-label={clip.name}
      >
        <video
          use:loads
          use:stillPoster={stillNear(index) ? clipAddress(clip) : undefined}
          use:loopByHand
          bind:this={videos[index]}
          data-grows={index === current ? clip.slug : undefined}
          onplay={() => {
            stopIfOffScreen(index);
          }}
          src={fetches(index) ? clipAddress(clip) : undefined}
          preload={preloads(index)}
          muted
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
        <!-- The whole clip opens its game's page, like the game's name on the band. It is left out of Tab and of what a
             screen reader reads because the name on the band is the same link. Every swipe starts on it, and opening a
             game's page records who brought this person, so it never loads that page ahead of a press. -->
        <a
          class="open"
          href={`/g/${clip.slug}`}
          data-sveltekit-preload-data="off"
          tabindex="-1"
          aria-hidden="true"
        ></a>

        <!-- The Good pick card, on the clip the feed asked it on, until it is answered. -->
        <GoodPick
          ask={asks[clip.key]}
          onanswered={() => {
            answered(clip.key, index);
          }}
        />

        {#if caughtUp.includes(clip.key)}
          <!-- One line to read on the first clip the person has seen before; the feed keeps going under it. -->
          <p class="caughtup">You're all caught up</p>
        {/if}

        {#if index === 0 && hint !== null}
          <div class="hints">
            <p>{hint === "touch" ? "Swipe up for more" : "Scroll down for more"}</p>
            <p>{hint === "touch" ? "Tap the speaker for sound" : "Click the speaker for sound"}</p>
          </div>
        {/if}

        <div class="lower">
          <div class="band" data-pad-first>
            {#if clip.friends.faces.length > 0}
              <!-- Friends who liked it: up to three faces, newest like first, then +N, floating over the clip above the
                   game's card and behind it (the owner, 2026-11-27: "floating in the air behind the floating UI, but in
                   front of the video like instagram"). A picture to look at, not a control, so Tab and a gamepad pass
                   over it and a press goes through to the clip. -->
              <div class="friends" role="img" aria-label={friendsWords(clip.friends)}>
                <svg class="liked" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
                    fill="currentColor"
                  />
                </svg>
                {#each clip.friends.faces as face, at (at)}
                  {#if face.photo !== null}
                    <img
                      class="face"
                      use:loads
                      src={face.photo}
                      alt=""
                      width="28"
                      height="28"
                      loading="lazy"
                    />
                  {:else}
                    <span class="face" aria-hidden="true">{initialOf(face.name)}</span>
                  {/if}
                {/each}
                {#if clip.friends.more > 0}
                  <span class="others" aria-hidden="true">+{clip.friends.more}</span>
                {/if}
              </div>
            {/if}
            <!-- A swipe can start on the name too, so it never loads the game's page (and who brought this person)
                 ahead of a press. -->
            <a class="gamelink" data-sveltekit-preload-data="off" href={`/g/${clip.slug}`}>
              <h2>{clip.name}</h2>
              <p>{clip.oneLine}</p>
            </a>
            {#if launch.before}
              <WishlistButton
                slug={clip.slug}
                wished={launch.wished.includes(clip.slug)}
                opens={launch.opens}
                back={tab === "followed" ? "/followed" : "/"}
                buttonClass="button play"
              />
            {:else}
              <!-- Opening the game counts a play, so it never loads ahead of a press. -->
              <a class="button play" data-sveltekit-preload-data="off" href={`/g/${clip.slug}/play`}>Play</a>
            {/if}
          </div>
          <div class="side">
            {#if clip.maker !== null}
              {@const maker = clip.maker}
              <div class="credit">
                <a class="maker" data-sveltekit-preload-data="off" href={`/${maker.handle}`}>
                  {#if maker.photo !== null}
                    <img use:loads src={maker.photo} alt="" width="48" height="48" loading="lazy" />
                  {:else}
                    <span class="initial" aria-hidden="true">{initialOf(maker.name)}</span>
                  {/if}
                  <span class="makername">{maker.name}</span>
                </a>
                {#if !maker.mine}
                  <FollowBadge
                    handle={maker.handle}
                    name={maker.name}
                    following={followed[maker.handle] ?? maker.following}
                    back={tab === "followed" ? "/followed" : "/"}
                    onchange={(now: boolean) => {
                      followed[maker.handle] = now;
                    }}
                  />
                {/if}
              </div>
            {/if}
            {#if ready}
              {@const marks = marksOf(clip)}
              {#if markProblem === clip.slug}
                <p class="markproblem" role="alert">That didn't work. Try again.</p>
              {/if}
              <button
                type="button"
                class="mark"
                aria-label="Like"
                aria-pressed={marks.liked}
                aria-disabled={sendingMarks.includes(`${clip.slug} like`) ? "true" : undefined}
                onclick={() => {
                  void press(clip, "like");
                }}
              >
                <span class="disc">
                  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                    <path
                      d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.4 4.5 7 4.5c2.1 0 3.6 1.2 5 3 1.4-1.8 2.9-3 5-3 3.6 0 5.6 3.5 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"
                      fill={marks.liked ? "currentColor" : "none"}
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span class="word" aria-hidden="true">{marks.likes > 0 ? marks.likes : "Like"}</span>
              </button>
              <button
                type="button"
                class="mark"
                aria-label="Save"
                aria-pressed={marks.saved}
                aria-disabled={sendingMarks.includes(`${clip.slug} save`) ? "true" : undefined}
                onclick={() => {
                  void press(clip, "save");
                }}
              >
                <span class="disc">
                  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                    <path
                      d="M6 3.5h12v17l-6-4.5-6 4.5z"
                      fill={marks.saved ? "currentColor" : "none"}
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
                <span class="word" aria-hidden="true">Save</span>
              </button>
              <button
                type="button"
                class="mark"
                aria-label="Repost"
                aria-pressed={marks.reposted}
                aria-disabled={sendingMarks.includes(`${clip.slug} repost`) ? "true" : undefined}
                onclick={() => {
                  void press(clip, "repost");
                }}
              >
                <span class="disc">
                  <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                    <path
                      d="M4 11V9a3 3 0 0 1 3-3h12m-3-3 3 3-3 3M20 13v2a3 3 0 0 1-3 3H5m3 3-3-3 3-3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width={marks.reposted ? 3 : 2}
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  {#if marks.reposted}
                    <!-- Reposted is told at a glance: a small green check in the button's corner, like a followed maker's. -->
                    <span class="done" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14">
                        <path d="M5 12.5l4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  {/if}
                </span>
                <!-- The button keeps its name, Repost, and says it is pressed; the word under it says what happened. -->
                <span class="word" aria-hidden="true">{marks.reposted ? "Reposted" : "Repost"}</span>
              </button>
            {/if}
            <button
              type="button"
              class="share"
              aria-label="Share"
              onclick={(event) => {
                shareSheet?.open({ slug: clip.slug, name: clip.name }, event.currentTarget);
              }}
            >
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path d="M3 11l18-8-8 18-2-8-8-2z" fill="currentColor" />
              </svg>
            </button>
            {#if tune}
              <button
                type="button"
                class="tunes"
                aria-label="More or less like this"
                onclick={(event) => {
                  tasteSheet?.open({ slug: clip.slug, name: clip.name }, event.currentTarget);
                }}
              >
                <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                  <path
                    d="M5 12h.01M12 12h.01M19 12h.01"
                    stroke="currentColor"
                    stroke-width="3.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            {/if}
          </div>
        </div>
      </section>
    {/each}
    {#if next !== null && ready}
      <!-- Past the last clip: the spinner while the next page comes, or what to do when it did not. Without script
           nothing would come, so it is only there once the script runs. -->
      <section bind:this={moreScreen} class="more" aria-busy={more === "failed" ? "false" : "true"}>
        {#if more === "failed"}
          <p>Couldn't load more games.</p>
          <button
            type="button"
            class="button"
            onclick={() => {
              void loadMore();
            }}>Try again</button
          >
        {:else}
          <span class="spinner" role="progressbar" aria-label="Loading more games"></span>
        {/if}
      </section>
    {/if}
  </main>
{/if}
<ShareSheet bind:this={shareSheet} {friends} />
{#if tune}
  <TasteSheet bind:this={tasteSheet} onsaved={sayGotIt} />
{/if}
<p class="gotit" role="status">{gotIt ? "Got it." : ""}</p>

<style>
  .feed {
    position: fixed;
    inset: 0;
    width: auto;
    margin: 0;
    overflow-y: auto;
    scroll-snap-type: y mandatory;
    overscroll-behavior: none;
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
  .more {
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 1rem;
    padding: 1rem 1rem 6rem;
    color: var(--chalk);
    text-align: center;
  }
  .more p {
    margin: 0;
  }
  .more .spinner {
    width: 2.5rem;
    height: 2.5rem;
  }
  video {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    background: var(--felt-deep);
  }
  /* The whole clip is one link to its game's page: a press anywhere on it that is not a link or a mark opens the game. */
  .open {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: block;
    margin: 0;
  }
  /* The speaker in the top bar flips sound, and shows which it is. */
  .sound {
    display: grid;
    place-items: center;
    width: var(--size-target);
    min-height: var(--size-target);
    padding: 0;
    border-radius: 50%;
    --corner: round;
    background: var(--glass-bg);
    color: var(--chalk);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  .sound svg,
  .share svg,
  .tunes svg,
  .mark svg {
    filter: var(--glass-icon);
    /* Its own layer, so its shadow is drawn once, not again each frame the video under the glass moves. */
    will-change: transform;
  }
  .sound:focus-visible,
  .share:focus-visible,
  .tunes:focus-visible {
    outline-offset: -6px;
  }
  /* Like, Save and Repost: a round glass button each, with its word (or the like count) under it on the clip. Pressed,
     the glass is the bar's brighter marked pill and the picture is filled in. */
  .mark {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    min-width: var(--size-target);
    min-height: 0;
    margin: 0;
    padding: 0;
    border-radius: 0;
    background: none;
    box-shadow: none;
    color: var(--chalk);
  }
  .disc {
    position: relative;
    display: grid;
    place-items: center;
    width: var(--size-target);
    height: var(--size-target);
    border-radius: 50%;
    --corner: round;
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  .mark[aria-pressed="true"] .disc {
    background: var(--glass-lift);
  }
  /* The check on a reposted clip's button: small, green glass, over the top right of the round button. */
  .done {
    position: absolute;
    top: -3px;
    right: -3px;
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    --corner: round;
    background: var(--glass-safe);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  .mark .done svg {
    filter: none;
    will-change: auto;
    fill: none;
    stroke: currentColor;
    stroke-width: 3.5;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  /* The word keeps to the button's width and spills evenly past both sides when it is longer ("Reposted"), so the
     column and the game's card beside it never move when it changes. */
  .word {
    display: flex;
    justify-content: center;
    width: var(--size-target);
    font: var(--text-small);
    font-weight: 600;
    white-space: nowrap;
    text-shadow: var(--glass-ink);
  }
  .markproblem {
    max-width: 7rem;
    margin: 0;
    padding: 0.25rem 0.5rem;
    border-radius: var(--radius-button);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    font: var(--text-small);
    text-align: center;
    text-shadow: var(--glass-ink);
  }
  /* Over the game's card and the friends' faces floating above it, which stay behind every floating piece. */
  .hints {
    position: absolute;
    top: 38%;
    left: 50%;
    z-index: 3;
    translate: -50% 0;
    width: max-content;
    max-width: calc(100% - 2rem);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-button);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    text-shadow: var(--glass-ink);
    text-align: center;
    pointer-events: none;
  }
  .hints p {
    margin: 0;
  }
  /* "You're all caught up": a frosted line just under the top bar, a word to read and never in the way of a press. */
  .caughtup {
    position: absolute;
    top: calc(max(0.75rem, env(safe-area-inset-top)) + var(--size-target) + 0.75rem);
    left: 50%;
    z-index: 2;
    translate: -50% 0;
    width: max-content;
    max-width: calc(100% - 2rem);
    margin: 0;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-button);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    text-shadow: var(--glass-ink);
    text-align: center;
    pointer-events: none;
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
    text-shadow: var(--glass-ink);
  }
  /* Frosted glass under the words (look.css). The glass alone is too clear to hold chalk over a white clip, so the words
     carry its dark halo (--glass-ink). */
  .band::before {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: inherit;
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  /* Friends who liked the game: small round faces overlapping a little, like a stack of coins, with a heart before them
     to say what they did, and +N after them. They float in the air over the clip, just above the game's card, under
     every button: a picture, never in the way of a press. */
  .friends {
    position: absolute;
    bottom: calc(100% + 0.5rem);
    left: 0;
    display: flex;
    align-items: center;
    pointer-events: none;
  }
  .liked {
    flex: none;
    margin-right: 0.375rem;
    color: var(--chalk);
    filter: var(--glass-icon);
  }
  .face,
  .others {
    flex: none;
    box-sizing: border-box;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    --corner: round;
    box-shadow: var(--glass-edge);
  }
  .face + .face,
  .face + .others {
    margin-left: -8px;
  }
  .face {
    display: grid;
    place-items: center;
    object-fit: cover;
    background: var(--paper);
    color: var(--ink);
    font: var(--text-small);
    font-weight: 600;
    text-shadow: none;
  }
  .others {
    display: grid;
    place-items: center;
    width: auto;
    min-width: 28px;
    padding: 0 0.25rem;
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    font: var(--text-small);
    font-weight: 600;
  }
  /* Play is coloured glass on the glass under the words. */
  .band .button {
    background: var(--glass-pay);
    box-shadow: var(--glass-edge);
  }
  .band a,
  .side button {
    pointer-events: auto;
  }
  /* The maker at the top of the column: their picture, the plus over its bottom edge, and their name under it. */
  .credit {
    --photo: 48px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 5.5rem;
  }
  .maker {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    min-height: var(--size-target);
    margin: 0;
    color: var(--chalk);
    text-shadow: var(--glass-ink);
    text-decoration: none;
    pointer-events: auto;
  }
  .maker img,
  .initial {
    flex: none;
    width: var(--photo);
    height: var(--photo);
    border-radius: 50%;
    --corner: round;
    object-fit: cover;
    box-shadow: var(--glass-edge);
  }
  .initial {
    display: grid;
    place-items: center;
    background: var(--paper);
    color: var(--ink);
    font-weight: 600;
    text-shadow: none;
  }
  /* Two lines at most, then cut with an ellipsis, so a long name never pushes Share down off the clip. */
  .makername {
    display: -webkit-box;
    max-width: 100%;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font: var(--text-small);
    font-weight: 600;
    text-align: center;
    overflow-wrap: anywhere;
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
  .play,
  .band :global(.wish .play) {
    width: 100%;
    margin: 0;
  }
  /* A column of round glass buttons at the right of the clip, starting with Share. */
  .side {
    position: relative;
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
  }
  /* "Got it." after a press on the ••• sheet: one frosted line near the top, for two seconds. Empty, it is not drawn,
     but stays in place so a screen reader hears it. */
  .gotit {
    position: fixed;
    top: 1rem;
    left: 50%;
    z-index: 5;
    translate: -50% 0;
    margin: 0;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-button);
    background: var(--glass-bg);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
    color: var(--chalk);
    text-shadow: var(--glass-ink);
    pointer-events: none;
  }
  .gotit:empty {
    display: none;
  }
  .share,
  .tunes {
    display: grid;
    place-items: center;
    width: var(--size-target);
    min-height: var(--size-target);
    padding: 0;
    border-radius: 50%;
    --corner: round;
    background: var(--glass-bg);
    color: var(--chalk);
    -webkit-backdrop-filter: var(--glass-filter);
    backdrop-filter: var(--glass-filter);
    box-shadow: var(--glass-edge);
  }
  /* A phone held upright is too narrow to centre the first open's tips between the column of round buttons on either
     side, so they start at the left, where the game's card does, and end short of the column (the review of #435: centred,
     they covered Save and Like). They stand just under the top bar, so their lines never reach the game's card. */
  @media (orientation: portrait) and (max-width: 499px) {
    .hints {
      top: calc(0.75rem + var(--size-target) + 0.75rem);
      left: 0.75rem;
      translate: none;
      max-width: calc(100% - 0.75rem - 5.5rem - 1.5rem);
    }
    /* On the first clip with "You're all caught up" too, the tips stand under the line (a 2.75rem line, then a gap),
       where they first stood over it and hid it (review 3 of #440). */
    .caughtup + .hints {
      top: calc(max(0.75rem, env(safe-area-inset-top)) + var(--size-target) + 0.75rem + 2.75rem + 0.5rem);
    }
  }
  /* A short phone held upright (an iPhone SE, 568px): the maker, their name and five round buttons stand taller than
     the room between the top bar and the bar, so the maker's picture went under Search and the tabs. Here the column
     closes up and the maker's name is left for a screen reader, the picture still opening their page. */
  @media (orientation: portrait) and (max-height: 600px) {
    .side {
      gap: 0.5rem;
    }
    /* Room for the plus, whose target hangs half its height below the picture, above Like. */
    .credit {
      padding-bottom: calc(var(--size-target) / 2);
    }
    .makername {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
  /* A phone held sideways: the window is short, so the words take one corner and the clip the rest. The bar stands
     along the right edge (Bar.svelte), so the band sits at the bottom with Play beside the game's name, the round
     buttons in a column left of the bar, and the first open's hints at the top, where the band cannot cover them. */
  @media (orientation: landscape) and (max-height: 449px) {
    .lower {
      --clear-of-bar: calc(3.5rem + 1.5rem + max(0.75rem, env(safe-area-inset-right)));
      inset: auto 0 0.75rem;
      /* Clear of the bar, the column of round buttons left of it, and the maker left of those. */
      padding-right: calc(var(--clear-of-bar) + var(--size-target) + 0.75rem + 5.5rem + 0.75rem);
      padding-left: max(0.75rem, env(safe-area-inset-left));
    }
    .band {
      flex-basis: 26rem;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      column-gap: 0.75rem;
      row-gap: 0.25rem;
      padding: 0.5rem 0.75rem;
    }
    .play {
      width: auto;
      padding-inline: 1.75rem;
    }
    .gamelink h2 {
      font-size: 1.25rem;
    }
    /* Under the top bar, where the band cannot cover them either. */
    .hints {
      top: calc(0.75rem + var(--size-target) + 0.5rem);
    }
    /* On the first clip with the line too, the hints stand under it, with a gap (they first stood right against it). */
    .caughtup + .hints {
      top: calc(max(0.75rem, env(safe-area-inset-top)) + var(--size-target) + 0.75rem + 2.75rem + 0.5rem);
    }
    /* The round buttons stand in a column of their own just left of the bar, from the bottom up: the bar takes the
       middle of the right edge, so under it there is no room for them (the owner, 2026-11-27: they sat on each other). */
    .side {
      position: absolute;
      right: var(--clear-of-bar);
      bottom: 0;
    }
    /* The window is too short for the maker above them there, so the maker stands just left of the column, at the
       bottom, clear of the bar. */
    .credit {
      position: absolute;
      right: calc(100% + 0.75rem);
      bottom: 0;
    }
  }
  .maker:focus-visible,
  .gamelink:focus-visible,
  .play:focus-visible,
  .band :global(.wish .play:focus-visible) {
    outline-color: var(--chalk);
  }
</style>
