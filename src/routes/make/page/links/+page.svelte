<!--
  Your links (spec 5.5, I8): each as it will appear on your page, how many times it was tapped, and what you can do to
  it: Up, Down, Hide or Show, and Remove. Each is a plain form button that works before the script wakes, drawn as an
  icon people know (a pencil, arrows, a bin) with its word as its name. Show and Hide stay words: an eye reads as the
  link's state, not as what pressing does. The one blue button is "Add a link".
-->
<script lang="ts">
  import Icon from "../../../../lib/icon.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<main class="games">
  <h1>Your links</h1>
  {#if data.links.length === 0}
    <p>You have no links yet.</p>
  {/if}
  {#each data.links as link (link.id)}
    <form class="card" method="POST" data-link>
      <input type="hidden" name="link" value={link.id} />
      <p>
        <strong>{link.title}</strong>
        {#if link.elsewhere}<span class="note">A game somewhere else</span>{/if}
        {#if link.icon}<span class="note">A small icon</span>{/if}
        <span class="note">{link.taps}{link.hidden ? " · Hidden" : ""}</span>
      </p>
      <p class="row">
        <a class="quiet" href={`/make/page/links/${link.id}`} aria-label="Change"><Icon name="change" /></a>
        {#if !link.first}<button class="quiet" formaction="?/up" aria-label="Up"><Icon name="up" /></button
          >{/if}
        {#if !link.last}<button class="quiet" formaction="?/down" aria-label="Down"
            ><Icon name="down" /></button
          >{/if}
        {#if link.hidden}
          <button class="quiet" formaction="?/show">Show</button>
        {:else}
          <button class="quiet" formaction="?/hide">Hide</button>
        {/if}
        <button class="quiet" formaction="?/remove" aria-label="Remove"><Icon name="remove" /></button>
      </p>
    </form>
  {/each}
  {#if data.full}
    <p class="note">A page can have up to {data.most} links. Remove one first.</p>
  {/if}
  <div class="acts">
    <a class="button safe" href="/make/page" aria-label="Back"><Icon name="back" /></a>
    {#if !data.full}
      <a class="button" href="/make/page/links/add">Add a link</a>
    {/if}
  </div>
</main>
