<!--
  The landing page: what Ruken is, for players and makers. Its order follows Lyft's home page (the spec,
  2026-11-22-landing-page-design.md): the ways in, one line of news, the headline with the one blue button and a real
  clip, a block for each audience, the membership, the steps, three short blocks, a closing card for each audience
  and the links at the foot. Every word comes from sections.ts.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { loads } from "../../lib/loads.ts";
  import { playOnScreen } from "../../lib/on-screen-video.ts";
  import { stillPoster } from "../../lib/still-poster.ts";
  import {
    AUDIENCES,
    CLOSING,
    FOOTER,
    HERO,
    MEMBERSHIP,
    MORE,
    NEWS,
    OPEN_CODE,
    SIGN_IN,
    SPLIT,
    STEPS,
    TOP_LINKS,
    TO_FEED,
  } from "./sections.ts";
  import { startMotion } from "./motion.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  let page: HTMLElement;

  let pastHero = $state(false);

  onMount(() => {
    const stop = startMotion(page);
    // The corner button shows once the first screen (with its own "Watch the feed") is out of sight.
    const hero = page.querySelector(".hero");
    const watcher = new IntersectionObserver(([entry]) => {
      pastHero = entry !== undefined && !entry.isIntersecting;
    });
    if (hero !== null) watcher.observe(hero);
    return () => {
      watcher.disconnect();
      stop();
    };
  });
  // Moving to and from the page is the app's own sideways slide (the layout, src/lib/page-moves.ts): a fade of its own
  // on top would empty the slide's picture of the page as it leaves.
</script>

<main class="about" bind:this={page}>
  <nav class="ways" aria-label="On this page">
    {#each TOP_LINKS as link (link.href)}
      <a href={link.href}>{link.words}</a>
    {/each}
    {#if !data.signedIn}
      <a href={SIGN_IN.href}>{SIGN_IN.words}</a>
    {/if}
  </nav>

  <section class="hero" aria-labelledby="about-title">
    {#if data.wall.length > 0}
      <!-- The first screen: the feed's own clips as a wall, drifting slowly, so the first thing anyone sees is games
           playing. It only decorates (a reader skips it); each clip plays only while it is on screen, and the wall stands
           still for a person who asked for less motion. Until a clip plays, its still (the frame it opens on) shows in
           its place. -->
      <div class="wall" aria-hidden="true">
        {#each data.wall as column, columnAt (columnAt)}
          <div class="column">
            {#each column as clip, rowAt (rowAt)}
              <video
                use:loads
                src={`${clip.upright}#t=${String(clip.at)}`}
                preload="none"
                muted
                playsinline
                tabindex="-1"
                use:stillPoster
                use:playOnScreen
              ></video>
            {/each}
          </div>
        {/each}
      </div>
    {/if}
    <div class="words">
      <!-- Each sentence is a line of its own, set in a solid box so it reads over the clips. -->
      <h1 id="about-title">
        <span><span>{HERO.heading[0]}</span></span>
        <span><span>{HERO.heading[1]}</span></span>
      </h1>
      <div class="say">
        {#each HERO.lines as line (line)}
          <p>{line}</p>
        {/each}
      </div>
      <p><a class="button" href={HERO.button.href}>{HERO.button.words}</a></p>
      <p class="news"><a href={NEWS.href}>{NEWS.words}</a></p>
    </div>
  </section>

  <div class="pair">
    {#each AUDIENCES as audience (audience.id)}
      <section class="card" id={audience.id} aria-labelledby={`${audience.id}-title`}>
        <p class="forwhom">{audience.forWhom}</p>
        <h2 id={`${audience.id}-title`}>{audience.heading}</h2>
        {#each audience.lines as line (line)}
          <p>{line}</p>
        {/each}
        <ul>
          {#each audience.points as point (point)}
            <li>{point}</li>
          {/each}
        </ul>
        <p class="links">
          {#each audience.links as link, index (link.href)}
            {#if index === 0}
              <a class="button outline" href={link.href}>{link.words}</a>
            {:else}
              <a class="more" href={link.href}>{link.words}</a>
            {/if}
          {/each}
        </p>
      </section>
    {/each}
  </div>

  <section class="plain band" aria-labelledby="membership-title">
    <h2 id="membership-title">{MEMBERSHIP.heading}</h2>
    <!-- One panel: the price big on the left, with the way to join under it, and what a member gets on the right. -->
    <div class="price">
      <div>
        <p class="amount"><span>{data.prices.monthly}</span> a month, or {data.prices.annual} a year</p>
        <p><a class="button outline" href={MEMBERSHIP.button.href}>{MEMBERSHIP.button.words}</a></p>
        <p class="note">{MEMBERSHIP.note}</p>
      </div>
      <ul class="perks">
        {#each MEMBERSHIP.perks as words (words)}
          <li>{words}</li>
        {/each}
      </ul>
    </div>
  </section>

  <section class="plain band" aria-labelledby="steps-title">
    <h2 id="steps-title">{STEPS.heading}</h2>
    <ol class="steps">
      {#each STEPS.steps as step (step.title)}
        <li><strong>{step.title}</strong> <span>{step.words}</span></li>
      {/each}
    </ol>
  </section>

  {#each MORE as section (section.id)}
    <section class="plain band" id={section.id} aria-labelledby={`${section.id}-title`}>
      <div>
        <p class="forwhom">{section.forWhom}</p>
        <h2 id={`${section.id}-title`}>{section.heading}</h2>
        {#each section.lines as line (line)}
          <p>{line}</p>
        {/each}
        {#if section.points.length > 0}
          <ul>
            {#each section.points as point (point)}
              <li>{point}</li>
            {/each}
          </ul>
        {/if}
        {#each section.links as link (link.href)}
          <p><a class="more" href={link.href}>{link.words}</a></p>
        {/each}
      </div>
      {#if section.picture !== undefined}
        <!-- A real screenshot of the app on a phone (the feed, or a maker's page), in a drawn phone's frame. -->
        <figure class="device">
          <img
            use:loads
            src={section.picture.src}
            alt={section.picture.alt}
            width="600"
            height="1298"
            loading="lazy"
          />
        </figure>
      {:else if section.id === "pay"}
        <!-- Where a member's money goes, drawn from the maker agreement. Each maker's own share comes with statements. -->
        <figure class="split">
          <figcaption>{SPLIT.title}</figcaption>
          <div class="splitbar" aria-hidden="true">
            {#each SPLIT.parts as part (part.id)}
              <span data-part={part.id}></span>
            {/each}
          </div>
          <ul>
            {#each SPLIT.parts as part (part.id)}
              <li data-part={part.id}>{part.words}</li>
            {/each}
          </ul>
        </figure>
      {/if}
    </section>
  {/each}

  <div class="pair closing">
    {#each CLOSING as closing (closing.heading)}
      <section class="card">
        <!-- A still from Floor Fifty behind the card, blurred, dimmed and drifting slowly: it only decorates. -->
        <img class="glow" use:loads src={closing.glow} alt="" aria-hidden="true" loading="lazy" />
        <h2>{closing.heading}</h2>
        <p><a class="button outline" href={closing.button.href}>{closing.button.words}</a></p>
      </section>
    {/each}
  </div>

  <section class="plain band opencode" aria-labelledby="opencode-title">
    <div>
      <h2 id="opencode-title">{OPEN_CODE.heading}</h2>
      {#each OPEN_CODE.lines as line (line)}
        <p>{line}</p>
      {/each}
      <p><a class="button outline" href={OPEN_CODE.button.href}>{OPEN_CODE.button.words}</a></p>
    </div>
  </section>

  <!-- Back to the feed from anywhere below the first screen (which has its own blue button): a phone with a fingertip
       swiping up it, in the corner. It slides in once the first screen has gone by. -->
  <a
    class="tofeed"
    href={TO_FEED.href}
    aria-label={TO_FEED.words}
    title={TO_FEED.words}
    data-away={pastHero ? undefined : ""}
    inert={!pastHero}
  >
    <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">
      <rect
        x="6"
        y="2.5"
        width="12"
        height="19"
        rx="2.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
      />
      <g class="swipe">
        <path d="M12 17.5v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
        <circle cx="12" cy="10.5" r="2" fill="currentColor" />
      </g>
    </svg>
  </a>

  <footer class="sitefoot">
    {#each FOOTER as column (column.heading)}
      <nav aria-label={column.heading}>
        <h2>{column.heading}</h2>
        <ul>
          {#each column.links as link (link.href)}
            <li><a href={link.href}>{link.words}</a></li>
          {/each}
        </ul>
      </nav>
    {/each}
  </footer>
</main>
