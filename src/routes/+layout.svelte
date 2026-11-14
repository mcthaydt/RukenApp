<!--
  The one place the look is loaded (src/lib/look.css). Every page renders inside it, so a screen is plain
  elements and the few classes the look names. The layout adds one thing: the Ruken wordmark, a way home above
  the card. The home page is the one screen without it, because its own heading is the name.
-->
<script lang="ts">
  import "../lib/look.css";
  import { page } from "$app/state";
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

{#if page.url.pathname !== "/"}
  <header><a class="wordmark" href="/">Ruken</a></header>
{/if}

{@render children()}
