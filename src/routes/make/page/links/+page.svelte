<!--
  Your links (spec 5.5, I8): each as it will appear on your page, how many times it was tapped, and what you can do to
  it: Up, Down, Hide or Show, and Remove. Each is a plain form button that works before the script wakes. The one blue
  button is "Add a link".
-->
<script lang="ts">
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
  {#each data.links as link (link.id)}
    <form class="card" method="POST" data-link>
      <input type="hidden" name="link" value={link.id} />
      <p>
        <strong>{link.title}</strong>
        {#if link.elsewhere}<span class="note">A game somewhere else</span>{/if}
        <span class="note">{link.taps}{link.hidden ? " · Hidden" : ""}</span>
      </p>
      <p class="row">
        <a class="quiet" href={`/make/page/links/${link.id}`}>Change</a>
        {#if !link.first}<button class="quiet" formaction="?/up">Up</button>{/if}
        {#if !link.last}<button class="quiet" formaction="?/down">Down</button>{/if}
        {#if link.hidden}
          <button class="quiet" formaction="?/show">Show</button>
        {:else}
          <button class="quiet" formaction="?/hide">Hide</button>
        {/if}
        <button class="quiet" formaction="?/remove">Remove</button>
      </p>
    </form>
  {/each}
  {#if data.full}
    <p class="note">A page can have up to {data.most} links. Remove one first.</p>
  {/if}
  <div class="acts">
    <a class="button safe" href="/make/page">Back</a>
    {#if !data.full}
      <a class="button" href="/make/page/links/add">Add a link</a>
    {/if}
  </div>
</main>
