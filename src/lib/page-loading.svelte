<!--
  The spinner at the top while the next page loads. A move between pages in the app keeps the old page up while the
  site answers, and the browser shows nothing for it, so without this a slow line looks like a tap that did nothing.
  Only the spinner, with no line and no words: the owner, 2026-11-22, "We don't need the Loading... text", and "show
  ONLY the spinner (no second indicator alongside it)".
  It shows only once a move has taken over 2 seconds (the owner, 2026-11-24: "only show the spinner if more than 2
  seconds have elapsed", for pages only), so a page that comes in that time never flashes it. Buttons, pictures and
  videos inside a page keep their own spinners as they are.
-->
<script lang="ts">
  import { navigating } from "$app/state";

  /** How long a move goes on before the spinner shows. */
  const SHOW_AFTER_MS = 2_000;

  let shown = $state(false);

  $effect(() => {
    if (navigating.to === null) {
      shown = false;
      return;
    }
    const timer = setTimeout(() => {
      shown = true;
    }, SHOW_AFTER_MS);
    return () => {
      clearTimeout(timer);
    };
  });
</script>

{#if shown}
  <p class="page-loading-spinner">
    <span class="spinner" role="progressbar" aria-label="Loading the page"></span>
  </p>
{/if}
