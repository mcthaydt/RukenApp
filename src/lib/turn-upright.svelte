<!--
  Asks for the phone upright when it is held sideways in a browser tab, where the browser's own bars leave too little
  height (the owner, 2026-11-24). Opened from the Home Screen, Ruken has the whole window, so sideways is allowed there
  and nothing shows. Whether it shows is the stylesheet's call (look.css, .upright: a phone held sideways only); this
  only leaves it out once the page knows it was opened from the Home Screen. The server cannot know that, so nothing
  shows until the page has started.
-->
<script lang="ts">
  import { onMount } from "svelte";

  let inATab = $state(false);

  onMount(() => {
    // Safari before 16.4 says so on navigator.standalone; every other browser through display-mode.
    const fromHomeScreen =
      matchMedia("(display-mode: standalone)").matches ||
      matchMedia("(display-mode: fullscreen)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    inATab = !fromHomeScreen;
  });
</script>

{#if inATab}
  <div class="upright" role="dialog" aria-modal="true" aria-labelledby="upright-heading">
    <div>
      <!-- A phone turning from sideways to upright. -->
      <svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">
        <rect
          x="16"
          y="6"
          width="16"
          height="28"
          rx="3"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
        />
        <path
          d="M8 30a16 16 0 0 0 14 12M8 30l-2 5M8 30l5 1.5"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <h2 id="upright-heading">Turn your phone upright</h2>
      <p>
        To use Ruken sideways, add it to your Home Screen from your browser's menu, then open it from there.
      </p>
    </div>
  </div>
{/if}
