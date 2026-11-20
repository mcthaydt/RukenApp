<!--
  The one place the look is loaded (src/lib/look.css). Every page renders inside it, so a screen is plain
  elements and the few classes the look names. The layout adds the Ruken wordmark, a way home above the card (the
  home page is the one screen without it, because its own heading is the name; the maker's area has its own bar),
  and, once, the line that says
  signing in undid a waiting deletion.
-->
<script lang="ts">
  import "../lib/look.css";
  import { page } from "$app/state";
  import type { LayoutProps } from "./$types";

  let { data, children }: LayoutProps = $props();
</script>

{#if page.url.pathname !== "/" && !page.url.pathname.startsWith("/make") && !page.url.pathname.startsWith("/g/")}
  <header><a class="wordmark" href="/">Ruken</a></header>
{/if}

{#if data.welcomeBack}
  <p role="status" class="panel">Welcome back. Your account will not be deleted.</p>
{/if}

{@render children()}
