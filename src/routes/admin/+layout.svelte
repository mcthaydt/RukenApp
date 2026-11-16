<!--
  Staff's pages wear the felt as the whole window, as the maker's area does: a bar with the way home, the list of games to
  check (the way into it from every staff page) and Your account, and under it whatever screen this is. There is no step to move through here, so nothing moves between pages.
-->
<script lang="ts">
  import type { LayoutProps } from "./$types";

  let { children }: LayoutProps = $props();
</script>

<div class="screen">
  <div class="topbar">
    <a class="wordmark" href="/">Ruken</a>
    <a href="/admin/games">Games to check</a>
    <a href="/me">Your account</a>
  </div>
  {@render children()}
</div>
