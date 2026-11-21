<!--
  Your links: each as a visitor will see it, with how often it was tapped, and one small button for each thing a maker
  can do with it: Up, Down, Hide or Show, Remove. Every button is its own form, so the list works before its script wakes.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Your links · Ruken</title>
</svelte:head>

<main class="games">
  <h1>Your links</h1>
  {#if data.links.length === 0}
    <p>You have no links yet.</p>
  {/if}
  <ul class="mylinks">
    {#each data.links as link, index (link.id)}
      <li data-hidden={link.hidden ? "" : undefined}>
        <p class="statement">{link.title}</p>
        {#if link.site !== null}
          <p>A game on {link.site}</p>
        {/if}
        <p class="note">
          {link.hidden ? "Hidden. " : ""}Tapped {link.taps}.
        </p>
        <form method="POST" use:enhance>
          <input type="hidden" name="link" value={link.id} />
          {#if index > 0}
            <button formaction="?/up" aria-label={`Move ${link.title} up`}>Up</button>
          {/if}
          {#if index < data.links.length - 1}
            <button formaction="?/down" aria-label={`Move ${link.title} down`}>Down</button>
          {/if}
          {#if link.hidden}
            <button formaction="?/show" aria-label={`Show ${link.title}`}>Show</button>
          {:else}
            <button formaction="?/hide" aria-label={`Hide ${link.title}`}>Hide</button>
          {/if}
          <button class="danger" formaction="?/remove" aria-label={`Remove ${link.title}`}>Remove</button>
        </form>
      </li>
    {/each}
  </ul>
  {#if data.full}
    <p class="note">A page can have up to {data.max} links. Remove one to add another.</p>
  {/if}
  <div class="acts">
    {#if !data.full}
      <a class="button" href="/make/page/links/add">Add a link</a>
    {/if}
    <a class="button safe" href="/make/page">Back</a>
  </div>
</main>
