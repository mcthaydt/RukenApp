<!--
  An icon in place of a word, where people understand the picture without one (the owner, 2026-11-22: "if something can
  just be an icon and people will understand, we use just the icon"). Drawn in the colour of the words around it. The
  button or link that holds it carries the words as its aria-label, so a screen reader and the journeys still read them.
-->
<script lang="ts">
  /** Which picture: an arrow back, a pencil (change), arrows up and down, an eye open (show) or shut (hide), a bin
   *  (remove) and a cross (close). */
  let { name }: { name: "back" | "change" | "up" | "down" | "show" | "hide" | "remove" | "close" } = $props();
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
  {:else if name === "show"}
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  {:else if name === "hide"}
    <path
      d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"
    />
  {:else if name === "remove"}
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  {:else}
    <path d="M6 6l12 12M18 6L6 18" />
  {/if}
</svg>
