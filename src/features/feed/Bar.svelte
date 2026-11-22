<!--
  The bar (spec 5.2), floating at the bottom in the middle of the feed, a game's page and a maker's page: Home, a big
  Add a game button in the middle that goes to Your games, and You. Each is a picture, not a word, so more can join
  later (the owner, 2026-11-22); each picture carries its name for a screen reader and a hover tip. The one for the
  screen a person is on is marked.
-->
<script lang="ts">
  /** Whether the person is on the feed, which is Home. */
  let { home }: { home: boolean } = $props();
</script>

<nav class="bar" aria-label="Ruken">
  <a href="/" aria-label="Home" title="Home" aria-current={home ? "page" : undefined}>
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <path
        d="M3 11.5 12 4l9 7.5M5.5 9.5V20h5v-5.5h3V20h5V9.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </a>
  <a href="/make" class="add" aria-label="Add a game" title="Add a game">
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        stroke-width="2.75"
        stroke-linecap="round"
      />
    </svg>
  </a>
  <a href="/me" aria-label="You" title="You">
    <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
      <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2" />
      <path
        d="M4 20.5c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
      />
    </svg>
  </a>
</nav>

<style>
  .bar {
    position: fixed;
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    left: 50%;
    z-index: 10;
    translate: -50% 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.25rem;
    border-radius: calc(var(--radius-button) + 0.25rem);
    background: var(--felt-deep);
  }
  .bar a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 4rem;
    min-height: var(--size-target);
    margin: 0;
    padding: 0;
    border-radius: var(--radius-button);
    color: var(--chalk);
    text-decoration: none;
  }
  .bar a[aria-current="page"] {
    background: var(--felt-raised);
  }
  /* The one main thing to do from the bar: the main button's blue, a little bigger than the others. */
  .bar a.add {
    min-width: 4.5rem;
    min-height: 3.25rem;
    background: var(--pay);
  }
  .bar a:active {
    scale: var(--press-scale);
    transition: scale var(--press-time);
  }
</style>
