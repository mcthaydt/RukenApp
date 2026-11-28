<!--
  The one place the look is loaded (src/lib/look.css). Every page renders inside it, so a screen is plain
  elements and the few classes the look names. The layout adds the Ruken wordmark, a way home above the card (the
  feed, a game's page and a maker's page are the people's own screens, so they have none; the maker's area has its own bar),
  the bar (Home, Add a game and You) on every screen but the few named in NO_BAR below, and, once, the line that says
  signing in undid a waiting deletion. Every wait shows it: the bar while a page loads, and a busy button on every plain
  form that is sent (src/lib/busy-forms.ts).
-->
<script lang="ts">
  import "../lib/look.css";
  import { afterNavigate, beforeNavigate, onNavigate } from "$app/navigation";
  import { page, updated } from "$app/state";
  import { answerAsk, consentAsk, setAgreed } from "../features/consent/consent.browser.ts";
  import { Notice } from "../features/consent/consent.screens.ts";
  import { Bar } from "../features/feed/feed.browser.ts";
  import { clearSending, markSending, SENDING_NEWS } from "../lib/busy-forms.ts";
  import {
    clipMoves,
    grownGame,
    heldMove,
    isFeed,
    moveBetween,
    noteMove,
    slideWhile,
  } from "../lib/page-moves.ts";
  import PageLoading from "../lib/page-loading.svelte";
  import TurnUpright from "../lib/turn-upright.svelte";
  import { sendInApp } from "../lib/stay-in-app.ts";
  import { startPad } from "../lib/pad-focus.ts";
  import { loadsAgainOnReturn, movesAsPageLoad } from "../lib/new-version.ts";
  import { BASE_TITLE } from "../lib/titles.ts";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  // Which of the bar's places the person is on: the feed, Your games or You, like an app's tabs (the owner, 2026-11-22).
  const place = $derived.by(() => {
    if (page.status >= 400) return null;
    // Followed is the feed's other tab, so it is Home too.
    if (page.route.id === "/" || page.route.id === "/followed") return "home";
    if (page.route.id === "/make") return "make";
    if (page.route.id === "/me") return "you";
    return null;
  });

  // The bar is on every screen (the owner, 2026-11-22: "every page excluding the landing pages") but three kinds:
  // the landing page, the play screens (a player's and the maker's test play: the game has the whole window), and the
  // maker's step-by-step screens, which pin their own Back and Save (src/lib/look.css, .screen .acts: across the
  // bottom, or along the right edge of a phone held sideways), so a second bar would leave little room for the
  // question. Each of those has its own way back. Your page is a step too while there is no page yet: it asks the first
  // question, the address.
  const NO_BAR: readonly string[] = [
    "/about",
    "/g/[game]/play",
    "/make/[game]/play",
    "/make/new",
    "/make/[game]/[question=question]",
    "/make/[game]/agreement",
    "/make/[game]/check",
    "/make/page/[room]",
    "/make/page/links/add",
    "/make/page/links/add/where",
    "/make/page/links/[link]",
    "/make/page/links/[link]/where",
  ];
  const barShown = $derived(
    !NO_BAR.includes(page.route.id ?? "") && !(page.route.id === "/make/page" && page.data.rooms === null),
  );

  // The feed, its Followed and Your turn tabs and Search fill the window with their own top bar, so they have no
  // wordmark above them.
  const FULL_SCREENS: readonly string[] = ["/", "/followed", "/your-turn", "/search"];
  // The pages the cookie notice sends a person to read never show it over themselves: Cookies, and What we keep (the
  // owner, 2026-11-28: the notice covers it and "makes it too hard to read"). Everywhere else the yes is asked as before.
  const READ_IN_PEACE: readonly string[] = ["/cookies", "/privacy"];
  // Nor the maker's pitch, which only a stranger sees (the plus, signed out): its Join Ruken and Sign in each need the
  // yes and ask it on their own screen, and a card over them would hide the screen's only buttons (review 1 of #462).
  const ASKED_NEXT: readonly string[] = ["/make"];

  // A game's own page, its play screen and its maker's test play name the game in the tab; every other screen, a
  // missing page included, has the base title.
  const gameScreen = $derived(
    page.status < 400 &&
      (page.route.id === "/g/[game]" ||
        page.route.id === "/g/[game]/play" ||
        page.route.id === "/make/[game]/play"),
  );

  // Until this browser says yes to cookies, the card at the bottom asks, once per visit ("Not now" hides it in memory
  // only, so a reload or a new visit asks again). Nothing is kept on the device until the yes (consent feature).
  let notNow = $state(false);
  $effect.pre(() => {
    setAgreed(data.consented);
  });

  function cameBack(event: PageTransitionEvent): void {
    if (event.persisted) clearSending();
    if (event.persisted) void checkForNewerVersion();
  }

  // A tab left open keeps the version it first loaded (src/lib/new-version.ts). Coming back to it, on the feed the
  // newer version loads at once; anywhere else it waits for the person's next move (beforeNavigate below). The page
  // says when the check is done, so a journey can tell a screen that stayed from one about to load again.
  async function checkForNewerVersion(): Promise<void> {
    const newer = await updated.check();
    if (newer && loadsAgainOnReturn(page.route.id)) {
      location.reload();
      return;
    }
    document.documentElement.dataset.versionChecked = "true";
  }

  function cameIntoView(): void {
    if (document.visibilityState === "visible") void checkForNewerVersion();
  }
  beforeNavigate((navigation) => {
    const move = {
      willUnload: navigation.willUnload,
      type: navigation.type,
      to: navigation.to?.url ?? null,
      here: new URL(location.href),
    };
    if (navigation.to !== null && movesAsPageLoad(updated.current, move)) {
      navigation.cancel();
      location.href = navigation.to.url.href;
    }
  });

  function sent(event: SubmitEvent): void {
    markSending(event);
    sendInApp(event);
  }

  // How many pages into Ruken this tab is, so the gamepad's B goes back only to a page of Ruken's, never out of it.
  // Counted as each move starts, not once its slide has ended, so a B pressed while a page slides in still counts it.
  let depth = 0;
  onNavigate((navigation) => {
    depth = navigation.type === "popstate" ? Math.max(depth + navigation.delta, 0) : depth + 1;
  });
  $effect(() => startPad({ canGoBack: () => depth > 0 }));

  // Inside the app the screen scrolls inside its own view, the body, not the page (look.css, the app view), so the
  // browser's own scroll keeping does not reach it: each screen opens at its top, and Back finds a screen where it was
  // left. A link to a place on a screen (#…) is the browser's to scroll to.
  const leftAt: Record<string, number | undefined> = {};
  beforeNavigate(({ from }) => {
    if (from !== null) leftAt[from.url.href] = document.body.scrollTop;
  });
  afterNavigate(({ from, to, type }) => {
    // The view takes the keys (arrows, Page Down, Space, End) only when it has the focus: the page around it never
    // scrolls, so a key with nothing focused would move nothing. The body can take the focus (tabindex -1, src/app.html);
    // a field or button a person or the screen has focused keeps it.
    const focused = document.activeElement;
    if (focused === null || focused === document.body) document.body.focus({ preventScroll: true });
    // A page that has just opened is at its top already, and a person may have scrolled it before it started. An answer
    // sent from a screen that comes back to the same screen keeps the person where they pressed (src/lib/stay-in-app.ts).
    if (to === null || type === "enter" || to.url.hash !== "") return;
    if (type !== "popstate" && from?.url.pathname === to.url.pathname) return;
    document.body.scrollTop = type === "popstate" ? (leftAt[to.url.href] ?? 0) : 0;
  });

  // Safari's own swipe back already slides the page; a second slide after it would play the move twice.
  let browserSlid = false;
  function wentBack(event: PopStateEvent): void {
    browserSlid = event.hasUAVisualTransition;
  }

  // Every move to another page slides sideways, the way the move goes (src/lib/page-moves.ts), for a person who
  // welcomes motion and a browser that has view transitions; anyone else gets the new page at once. It starts once the
  // new page has loaded, so the loading bar shows the wait as before, and the bar of places stays where it is.
  onNavigate((navigation) => {
    const from = navigation.from?.url.pathname;
    const to = navigation.to?.url.pathname;
    const back = navigation.type === "popstate" && navigation.delta < 0;
    const move = from === undefined || to === undefined ? null : moveBetween(from, to, back);
    const slid = browserSlid;
    browserSlid = false;
    // A move made while the last one's slide still holds its page (Back pressed mid-slide) waits for that page to go in
    // and then comes in after it, at once.
    // How far the move goes in the history: Back or Forward by the browser's own count, any other move one page on.
    const steps = navigation.type === "popstate" ? navigation.delta : 1;
    const earlier = heldMove();
    if (earlier !== null) {
      noteMove(null, to ?? "", steps);
      return earlier;
    }
    // A move inside the maker's area is that area's own step (src/routes/make/+layout.svelte).
    if (move === null) {
      noteMove(null, to ?? "", steps);
      return;
    }
    // Between the feed and a game's page the game's clip moves instead: opening it from the feed's clip, and with Back
    // to the feed it was opened from (src/lib/page-moves.ts).
    const game = grownGame(from ?? "", to ?? "");
    const grows = game !== null && clipMoves(game, isFeed(to ?? ""), back);
    noteMove(grows ? game : null, to ?? "", steps);
    const html = document.documentElement;
    delete html.dataset.step;
    delete html.dataset.move;
    delete html.dataset.way;
    if (
      slid ||
      !("startViewTransition" in document) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // The mark stays until the next move: while it is on, the maker area's rising lines keep still, so a page that
    // slides in does not also rise (look.css).
    html.dataset.move = grows ? "grow" : move;
    // Back to the feed the clip's move plays as the exact reverse of the move out (look.css).
    if (grows && isFeed(to ?? "")) html.dataset.way = "back";
    return slideWhile(navigation.complete, grows ? game : null);
  });
</script>

<svelte:head>
  {#if !gameScreen}
    <title>{BASE_TITLE}</title>
  {/if}
</svelte:head>

<svelte:document onsubmit={sent} onvisibilitychange={cameIntoView} />
<svelte:window onpageshow={cameBack} onpopstate={wentBack} />

<PageLoading />
<!-- Says "Sending…" to a screen reader when a plain form is sent (src/lib/busy-forms.ts). -->
<p class="hidden-words" id={SENDING_NEWS} aria-live="polite"></p>

{#if !FULL_SCREENS.includes(page.url.pathname) && !page.url.pathname.startsWith("/make") && !page.url.pathname.startsWith("/g/") && !(page.route.id === "/[handle=handle]" && page.status < 400)}
  <header><a class="wordmark" href="/">Ruken</a></header>
{/if}

{#if data.welcomeBack}
  {#if page.route.id === "/"}
    <p role="status" class="panel over">Welcome back. Your account will not be deleted.</p>
  {:else}
    <p role="status" class="panel">Welcome back. Your account will not be deleted.</p>
  {/if}
{/if}

<!-- Before the screen, so Tab reaches it first: the feed never ends, so after it Tab would never get there. -->
{#if barShown}
  <Bar on={place} />
{/if}

{@render children()}

{#if page.route.id !== "/about"}
  <TurnUpright />
{/if}

<!-- A press that needs the yes opens the card again, even after "Not now", and says what for (consent/ask.svelte.ts). -->
{#if !data.consented && (!notNow || consentAsk.reason !== null) && !READ_IN_PEACE.includes(page.route.id ?? "") && (!ASKED_NEXT.includes(page.route.id ?? "") || consentAsk.reason !== null)}
  <Notice
    card
    aboveBar={barShown}
    reason={consentAsk.reason}
    next={page.url.pathname + page.url.search}
    from={page.url.pathname + page.url.search}
    onNotNow={() => {
      notNow = true;
      answerAsk(false);
    }}
    onAgreed={() => {
      answerAsk(true);
    }}
  />
{/if}
