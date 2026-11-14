<!--
  The new-game form. Before GitHub is connected: one sentence and one button. After: name, one line, which repository,
  where it plays, and one button. The branch and folder, and the servers a game talks to, stay closed unless wanted
  (a `details` opens with no script). Copying a game can take a minute, so a note under the button says the press was
  taken. Every refusal sits above the button, in words that say what to fix, and what was typed stays.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // Where the game plays: after a refusal the one that was chosen. State bound to the two radio buttons, not a value
  // written onto them, as on the paywall card: a person on a slow phone keeps the choice made before the page woke.
  // svelte-ignore state_referenced_locally
  let chosen = $state({ playsOn: form?.playsOn ?? "phone_and_computer" });
</script>

<svelte:head>
  <title>New game · Ruken</title>
</svelte:head>

<main class="card">
  <h1>New game</h1>
  {#if data.repositories.length === 0}
    <p>Ruken copies your game from your GitHub repository.</p>
    <p>It needs a folder with an index.html that runs in a browser.</p>
    {#if data.connectionFailed}
      <p class="problem" role="alert">GitHub didn't finish connecting. Try again.</p>
    {/if}
    <p><a class="button" href="/make/github?choose=1">Connect GitHub</a></p>
  {:else}
    <form method="POST" action="?/create">
      <p>
        <label>
          Name
          <input type="text" name="name" autocomplete="off" value={form?.name} />
        </label>
      </p>
      <p>
        <label>
          One line
          <input type="text" name="oneLine" autocomplete="off" value={form?.oneLine} />
        </label>
      </p>
      <p>
        <label>
          Game files
          <select name="repo">
            {#each data.repositories as repository (repository.fullName)}
              <option value={repository.fullName} selected={form?.repo === repository.fullName}>
                {repository.fullName}
              </option>
            {/each}
          </select>
        </label>
        <a href="/make/github?choose=1">Choose other repositories on GitHub</a>
      </p>
      <!-- Open again after a refusal when something was typed in it, so a person sees what they typed. -->
      <details open={Boolean(form?.branch) || Boolean(form?.folder)}>
        <summary>Change the branch or folder</summary>
        <p>
          <label>
            Branch
            <input type="text" name="branch" autocomplete="off" value={form?.branch} />
          </label>
          <span class="note">Leave empty for your main branch.</span>
        </p>
        <p>
          <label>
            Folder
            <input type="text" name="folder" autocomplete="off" value={form?.folder} />
          </label>
          <span class="note">Leave empty if index.html is at the top.</span>
        </p>
      </details>
      <fieldset>
        <legend>Plays on</legend>
        <label class="choice">
          <input type="radio" name="playsOn" value="phone_and_computer" bind:group={chosen.playsOn} />
          Phone and computer
        </label>
        <label class="choice">
          <input type="radio" name="playsOn" value="computer_only" bind:group={chosen.playsOn} />
          Computer only
        </label>
      </fieldset>
      <details open={form?.serversProblem !== undefined}>
        <summary>My game talks to a server</summary>
        <p>
          <label>
            Game servers
            <textarea name="servers" rows="3" autocomplete="off">{form?.servers}</textarea>
          </label>
          <span class="note"
            >One per line, like api.example.com. Leave empty if your game runs on its own.</span
          >
        </p>
        {#if form?.serversProblem}
          <p class="problem" role="alert">{form.serversProblem}</p>
        {/if}
      </details>
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button>Next: add your clips</button>
      <p class="note">Copying your game can take a minute. Keep this page open.</p>
    </form>
  {/if}
</main>
