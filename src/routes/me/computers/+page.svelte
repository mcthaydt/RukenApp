<!--
  Your computers: the computers that can use your Ruken from a terminal or an editor. One row for each, with its name,
  when it was let in and when it was last used. Rename changes the name; Remove stops it at once.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>Your computers · Ruken</title>
</svelte:head>

<main class="card">
  <h1>Your computers</h1>
  {#if form?.removed}
    <p role="status">Removed. That computer can't use your Ruken any more.</p>
  {/if}
  {#if data.computers.length === 0}
    <p>No computers can use your Ruken.</p>
    <p>To add one, type <code>npx ruken sign-in</code> on that computer.</p>
  {:else}
    <ul class="computers">
      {#each data.computers as computer (computer.id)}
        <li>
          <p><strong>{computer.name}</strong></p>
          <p class="note">Let in on {computer.addedOn}. Last used on {computer.lastUsedOn}.</p>
          {#if form?.renamed === computer.id}
            <p role="status">Renamed.</p>
          {/if}
          {#if form?.problem && form.id === computer.id}
            <p class="problem" role="alert">{form.problem}</p>
          {/if}
          <form method="POST" action="?/rename">
            <input type="hidden" name="id" value={computer.id} />
            <label>
              Its name
              <input name="name" value={computer.name} maxlength="60" />
            </label>
            <button class="outline">Rename</button>
          </form>
          <form method="POST" action="?/remove">
            <input type="hidden" name="id" value={computer.id} />
            <button class="danger">Remove</button>
          </form>
        </li>
      {/each}
    </ul>
  {/if}
  <p class="note"><a href="/me">Back to your account</a></p>
</main>
