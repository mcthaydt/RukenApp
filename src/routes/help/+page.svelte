<!--
  Ruken's help for makers. No paper sheet: a big title in chalk on the felt, a line that says what the guides are for,
  and the three guides as three big numbered tiles, one tone each, in the order a maker needs them. A whole tile is the
  target, and the guide's name is its link, so a screen reader reads each guide by its name. The way back to Ruken is an
  arrow on its own (the owner, 2026-11-22: an icon on its own wherever people understand it, and no underlined words).
-->
<script lang="ts">
  const guides = [
    {
      href: "/help/get-your-game-on-ruken?from=%2Fhelp",
      name: "Get your game on Ruken",
      line: "Every step, from your game's folder to the feed.",
    },
    {
      href: "/help/github?from=%2Fhelp",
      name: "Put your game on GitHub",
      line: "A free place for your game's files. Ruken copies your game from there.",
    },
    {
      href: "/help/record-screen?from=%2Fhelp",
      name: "Record your screen",
      line: "A 10 to 30 second video of you playing. It's what people see in the feed.",
    },
  ];
</script>

<main class="helpdesk">
  <a class="back" href="/" aria-label="Back to Ruken">
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </svg>
  </a>
  <h1>Help for makers</h1>
  <p class="lead">Three short guides. Start with the first.</p>
  <nav aria-label="Guides">
    <ol>
      {#each guides as guide, index (guide.href)}
        <li class="guide">
          <span class="number" aria-hidden="true">{index + 1}</span>
          <h2><a href={guide.href}>{guide.name}</a></h2>
          <p>{guide.line}</p>
          <svg class="arrow" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </li>
      {/each}
    </ol>
  </nav>
  <!-- What is Ruken? (the landing page's link goes here once /about is on main) -->
</main>
