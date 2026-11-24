<!--
  An icon in place of a word, where people understand the picture without one (the owner, 2026-11-22: "if something can
  just be an icon and people will understand, we use just the icon"). Drawn in the colour of the words around it. The
  button or link that holds it carries the words as its aria-label, so a screen reader and the journeys still read them.
-->
<script lang="ts">
  /** Which picture: an arrow back, a pencil (change), arrows up and down, a bin (remove), a cross (close) and a flag (report). No eye:
   *  an open or shut eye reads as the link's state, not as what pressing does (review 2026-11-22), so Show and Hide stay
   *  words. */
  let { name }: { name: "back" | "change" | "up" | "down" | "remove" | "close" | "flag" } = $props();
</script>

<svg class="icon" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
  {#if name === "back"}
    <path d="M19 12H5M11 5l-7 7 7 7" />
  {:else if name === "change"}
    <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
  {:else if name === "up"}
    <path d="M12 19V5M5 12l7-7 7 7" />
  {:else if name === "down"}
    <path d="M12 5v14M5 12l7 7 7-7" />
  {:else if name === "remove"}
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  {:else if name === "flag"}
    <path d="M5 21V4M5 4h12l-2.5 4.5L17 13H5" />
  {:else}
    <path d="M6 6l12 12M18 6L6 18" />
  {/if}
</svg>
