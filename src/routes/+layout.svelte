<!--
  The one place the look is loaded (src/lib/look.css). Every page renders inside it, so a screen is plain
  elements and the few classes the look names. The layout adds the Ruken wordmark, a way home above the card (the
  home page is the one screen without it, because its own heading is the name; the maker's area and staff's area have
  their own bar, which carries the wordmark, except on an error page, which is drawn outside it), and, once, the line that says
  signing in undid a waiting deletion.
-->
<script lang="ts">
  import "../lib/look.css";
  import { page } from "$app/state";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();

  // The staff's own pages have a bar with the wordmark in it. The error page inside /admin is drawn outside that bar, so it
  // has the header every other error page has.
  const inStaffsArea = $derived(page.url.pathname.startsWith("/admin"));
  // While a game is played the game is the window: the play screen has its own strip with the way back.
  const playing = $derived(/^\/g\/[^/]+\/play$/.test(page.url.pathname) && page.error === null);
</script>

{#if page.url.pathname !== "/" && !page.url.pathname.startsWith("/make") && !(inStaffsArea && page.error === null) && !playing}
  <header><a class="wordmark" href="/">Ruken</a></header>
{/if}

{#if data.welcomeBack}
  <p role="status" class="panel">Welcome back. Your account will not be deleted.</p>
{/if}

{@render children()}
