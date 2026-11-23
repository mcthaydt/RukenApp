<!--
  The one place the look is loaded (src/lib/look.css). Every page renders inside it, so a screen is plain
  elements and the few classes the look names. The layout adds the Ruken wordmark, a way home above the card (the
  feed, a game's page and a maker's page are the people's own screens, so they have none; the maker's area has its own bar),
  the bar (Home, Add a game and You) on those same three screens, and, once, the line that says
  signing in undid a waiting deletion. Every wait shows it: the bar while a page loads, and a busy button on every plain
  form that is sent (src/lib/busy-forms.ts).
-->
<script lang="ts">
  import "../lib/look.css";
  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { setAgreed } from "../features/consent/consent.browser.ts";
  import { Notice } from "../features/consent/consent.screens.ts";
  import { Bar } from "../features/feed/feed.browser.ts";
  import { clearSending, markSending, SENDING_NEWS } from "../lib/busy-forms.ts";
  import { moveBetween, slideWhile } from "../lib/page-moves.ts";
  import PageLoading from "../lib/page-loading.svelte";
  import { sendInApp } from "../lib/stay-in-app.ts";
  import { BASE_TITLE } from "../lib/titles.ts";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  // The screens a player browses: the feed, a game's page and a maker's page. A play screen, the maker's area and
  // Ruken's card screens keep the wordmark as their way home. A missing page of these is a card screen too.
  const browsing = $derived(
    page.status < 400 &&
      (page.route.id === "/" || page.route.id === "/g/[game]" || page.route.id === "/[handle=handle]"),
  );

  // The tops of Your games and You carry the bar too, so the three feel like an app's tabs (the owner, 2026-11-22).
  const place = $derived.by(() => {
    if (page.status >= 400) return null;
    if (page.route.id === "/") return "home";
    if (page.route.id === "/make") return "make";
    if (page.route.id === "/me") return "you";
    return null;
  });

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
  }

  function sent(event: SubmitEvent): void {
    markSending(event);
    sendInApp(event);
  }

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
    // A move inside the maker's area is that area's own step (src/routes/make/+layout.svelte).
    if (move === null) return;
    const html = document.documentElement;
    delete html.dataset.step;
    delete html.dataset.move;
    if (
      slid ||
      !("startViewTransition" in document) ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // The mark stays until the next move: while it is on, the maker area's rising lines keep still, so a page that
    // slides in does not also rise (look.css).
    html.dataset.move = move;
    return slideWhile(navigation.complete);
  });
</script>

<svelte:head>
  {#if !gameScreen}
    <title>{BASE_TITLE}</title>
  {/if}
</svelte:head>

<svelte:document onsubmit={sent} />
<svelte:window onpageshow={cameBack} onpopstate={wentBack} />

<PageLoading />
<!-- Says "Sending…" to a screen reader when a plain form is sent (src/lib/busy-forms.ts). -->
<p class="hidden-words" id={SENDING_NEWS} aria-live="polite"></p>

{#if page.url.pathname !== "/" && !page.url.pathname.startsWith("/make") && !page.url.pathname.startsWith("/g/") && !(page.route.id === "/[handle=handle]" && page.status < 400)}
  <header><a class="wordmark" href="/">Ruken</a></header>
{/if}

{#if data.welcomeBack}
  {#if page.route.id === "/"}
    <p role="status" class="panel over">Welcome back. Your account will not be deleted.</p>
  {:else}
    <p role="status" class="panel">Welcome back. Your account will not be deleted.</p>
  {/if}
{/if}

{#if browsing || place !== null}
  <Bar on={place} />
{/if}

{@render children()}

{#if !data.consented && !notNow && page.route.id !== "/cookies"}
  <Notice
    card
    aboveBar={browsing}
    next={page.url.pathname + page.url.search}
    from={page.url.pathname + page.url.search}
    onNotNow={() => (notNow = true)}
  />
{/if}
