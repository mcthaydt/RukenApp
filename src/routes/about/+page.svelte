<!--
  The landing page: what Ruken is, for players and makers. Its order follows Lyft's home page (the spec,
  2026-11-22-landing-page-design.md): the ways in, one line of news, the headline with the one blue button and a real
  clip, a block for each audience, the membership, the steps, three short blocks, a closing card for each audience
  and the links at the foot. Every word comes from sections.ts.
-->
<script lang="ts">
  import { loads } from "../../lib/loads.ts";
  import { quietVideo } from "../../lib/quiet-video.ts";
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

  <p class="news"><a href={NEWS.href}>{NEWS.words}</a></p>

  <section class="hero" aria-labelledby="about-title">
    <div>
      <h1 id="about-title"><span>{HERO.heading[0]}</span> <span>{HERO.heading[1]}</span></h1>
      {#each HERO.lines as line (line)}
        <p>{line}</p>
      {/each}
      <p><a class="button" href={HERO.button.href}>{HERO.button.words}</a></p>
    </div>
    {#if data.clip !== null}
      <!-- The top game in the feed, as the picture of what Ruken is. It is the feed's own clip, so it is never a mock-up. -->
      <figure class="phone">
        <video
          use:loads
          src={data.clip.upright}
          preload="metadata"
          muted
          loop
          playsinline
          aria-label={`A clip of ${data.clip.name}`}
          use:quietVideo
        ></video>
        <figcaption><a class="more" href={`/g/${data.clip.slug}`}>{data.clip.name}</a></figcaption>
      </figure>
    {/if}
  </section>

  {#if data.reel.length > 0}
    <!-- Live games running past, as the feed shows them. It only decorates: the clips are not links and a reader skips
         it. It is shown twice in a row so the loop has no seam, and it stands still for a person who asked for less
         motion. -->
    <div class="reel" aria-hidden="true">
      <div class="reel-track">
        {#each [0, 1] as copy (copy)}
          {#each data.reel as clip, index (`${String(copy)}-${String(index)}`)}
            <video
              use:loads
              src={`${clip.upright}#t=${String(clip.at)}`}
              preload="metadata"
              muted
              loop
              playsinline
              tabindex="-1"
              use:quietVideo
            ></video>
          {/each}
        {/each}
      </div>
    </div>
  {/if}

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
        <!-- A live game's clip, playing where a video may play by itself: what the section is about, never a mock-up. -->
        <figure class="still">
          <video
            use:loads
            src={`${still.wide}#t=${String(still.at)}`}
            preload="metadata"
            muted
            loop
            playsinline
            tabindex="-1"
            aria-label={`A clip of ${still.name}`}
            use:quietVideo
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
