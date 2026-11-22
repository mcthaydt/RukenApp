<!--
  The landing page: what Ruken is, for players and makers. Its order follows Lyft's home page (the spec,
  2026-11-22-landing-page-design.md): the ways in, one line of news, the headline with the one blue button and a real
  clip, a block for each audience, the membership, the steps, three short blocks, a closing card for each audience
  and the links at the foot. Every word comes from sections.ts.
-->
<script lang="ts">
  import { loads } from "../../lib/loads.ts";
  import { playOnScreen } from "../../lib/on-screen-video.ts";
  import {
    AUDIENCES,
    CLOSING,
    FOOTER,
    HERO,
    MEMBERSHIP,
    membershipCards,
    MORE,
    NEWS,
    SIGN_IN,
    STEPS,
    TOP_LINKS,
  } from "./sections.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<main class="about">
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
           still for a person who asked for less motion. -->
      <div class="wall" aria-hidden="true">
        {#each data.wall as column, columnAt (columnAt)}
          <div class="column">
            {#each column as clip, rowAt (rowAt)}
              <video
                use:loads
                src={`${clip.upright}#t=${String(clip.at)}`}
                preload="none"
                muted
                loop
                playsinline
                tabindex="-1"
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
    <ul class="perks">
      {#each membershipCards(data.prices) as words (words)}
        <li>{words}</li>
      {/each}
    </ul>
    <p class="note">{MEMBERSHIP.note}</p>
    <p><a class="button outline" href={MEMBERSHIP.button.href}>{MEMBERSHIP.button.words}</a></p>
  </section>

  <section class="plain band" aria-labelledby="steps-title">
    <h2 id="steps-title">{STEPS.heading}</h2>
    <ol class="steps">
      {#each STEPS.steps as step (step.title)}
        <li><strong>{step.title}</strong> <span>{step.words}</span></li>
      {/each}
    </ol>
  </section>

  {#each MORE as section, index (section.id)}
    {@const still = data.stills[index] ?? null}
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
      {#if still !== null}
        <!-- A live game's clip, playing while it is on screen: what the section is about, never a mock-up. -->
        <figure class="still">
          <video
            use:loads
            src={`${still.wide}#t=${String(still.at)}`}
            preload="none"
            muted
            loop
            playsinline
            tabindex="-1"
            aria-label={`A clip of ${still.name}`}
            use:playOnScreen
          ></video>
        </figure>
      {/if}
    </section>
  {/each}

  <div class="pair">
    {#each CLOSING as closing (closing.heading)}
      <section class="card">
        <h2>{closing.heading}</h2>
        <p><a class="button outline" href={closing.button.href}>{closing.button.words}</a></p>
      </section>
    {/each}
  </div>

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
