<!--
  The one place the look is loaded (src/lib/look.css). Every page renders inside it, so a screen is plain
  elements and the few classes the look names. The layout adds the Ruken wordmark, a way home above the card (the
  feed, a game's page and a maker's page are the people's own screens, so they have none; the maker's area has its own bar),
  the bar of Home and You on those same three screens, and, once, the line that says
  signing in undid a waiting deletion.
-->
<script lang="ts">
  import "../lib/look.css";
  import { page } from "$app/state";
  import { Bar } from "../features/feed/feed.browser.ts";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  // The screens a player browses: the feed, a game's page and a maker's page. A play screen, the maker's area and
  // Ruken's card screens keep the wordmark as their way home. A missing page of these is a card screen too.
  const browsing = $derived(
    page.status < 400 &&
      (page.route.id === "/" || page.route.id === "/g/[game]" || page.route.id === "/[handle=handle]"),
  );
</script>

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

{#if browsing}
  <Bar home={page.route.id === "/"} />
{/if}

{@render children()}
