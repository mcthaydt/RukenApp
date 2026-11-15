<!--
  The one place the look is loaded (src/lib/look.css). Every page renders inside it, so a screen is plain
  elements and the few classes the look names. The layout adds the Ruken wordmark, a way home above the card (the
  home page is the one screen without it, because its own heading is the name; the maker's area has its own bar, and
  so do the pages a maker is sent to from it),
  and, once, the line that says
  signing in undid a waiting deletion.
-->
<script lang="ts">
  import "../lib/look.css";
  import { page } from "$app/state";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  // The how-to pages and the maker agreement are reached from the maker's own screens and lead back to them, so they have
  // the maker's bar: the wordmark stays where it was, and does not jump to the card's column.
  const inMakersWay = $derived(
    page.url.pathname.startsWith("/help") || page.url.pathname === "/legal/maker-agreement",
  );
</script>

{#if page.url.pathname !== "/" && !page.url.pathname.startsWith("/make")}
  {#if inMakersWay}
    <div class="topbar"><a class="wordmark" href="/">Ruken</a></div>
  {:else}
    <header><a class="wordmark" href="/">Ruken</a></header>
  {/if}
{/if}

{#if data.welcomeBack}
  <p role="status" class="panel">Welcome back. Your account will not be deleted.</p>
{/if}

{@render children()}
