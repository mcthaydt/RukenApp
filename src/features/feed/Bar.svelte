<!--
  The bar (spec 5.2): Home and You, floating at the bottom in the middle of the feed, a game's page and a maker's page.
  The one for the screen a person is on is marked. Each is a word and a big, plain link.
-->
<script lang="ts">
  /** Whether the person is on the feed, which is Home. */
  let { home }: { home: boolean } = $props();
</script>

<nav class="bar" aria-label="Ruken">
  <a href="/" aria-current={home ? "page" : undefined}>Home</a>
  <a href="/me">You</a>
</nav>

<style>
  .bar {
    position: fixed;
    bottom: max(0.75rem, env(safe-area-inset-bottom));
    left: 50%;
    z-index: 10;
    translate: -50% 0;
    display: flex;
    gap: 0.25rem;
    padding: 0.25rem;
    border-radius: calc(var(--radius-button) + 0.25rem);
    background: var(--felt-deep);
  }
  .bar a {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 5.5rem;
    min-height: var(--size-target);
    margin: 0;
    padding: 0 1.25rem;
    border-radius: var(--radius-button);
    color: var(--chalk);
    font: var(--text-button);
    text-decoration: none;
  }
  .bar a[aria-current="page"] {
    background: var(--felt-raised);
  }
</style>
