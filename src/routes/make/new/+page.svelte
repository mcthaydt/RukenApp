<!--
  The new-game form, with a way back to the maker's games. Before GitHub is connected: what Ruken will see, and one
  button. Connected but nothing chosen on GitHub: one sentence and one button to choose some. After: the game's
  files first (the trip to GitHub for a repository that is not listed leaves nothing typed to lose), then the name, one
  line, where it plays, and one button. Each box says what goes in it (design 5.4), and no repository is chosen for the
  maker. The branch and folder, and the other websites a game uses, stay closed unless wanted (a `details` opens with no
  script). Every refusal is shown at once, each under its own box, and the first refused box takes the focus; what was
  typed stays. Copying a game can take a minute, so from the press the button says so and cannot be pressed again.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { tick } from "svelte";
  import { focusFirstRefused } from "../../../lib/focus.ts";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // True from the press of the button until the answer comes: copying a game can take a minute, and a person who sees
  // nothing change presses again. Without script the page simply waits.
  let copying = $state(false);

  // The words for each box that is wrong, and the ids a reader is pointed at for each box.
  const problems = $derived<Record<string, string | undefined>>(form?.problems ?? {});
  const describedBy = (box: string, refused: string | undefined) =>
    refused === undefined ? `${box}-hint` : `${box}-hint ${box}-problem`;

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
  {#if !data.connected}
    <p>Ruken copies your game from your GitHub repository.</p>
    <p>It needs a folder with an index.html that runs in a browser.</p>
    <p>You choose which repositories Ruken can see. It can't see anything else.</p>
    {#if data.connectionFailed}
      <p class="problem" role="alert">GitHub didn't finish connecting. Try again.</p>
    {/if}
    <!-- A server redirect to GitHub, not a page: the browser must ask the server, not route to a game called "github". -->
    <p><a class="button" href="/make/github?choose=1" data-sveltekit-reload>Connect GitHub</a></p>
  {:else if data.repositories.length === 0}
    <p>Ruken can't see any of your repositories yet.</p>
    <p>
      <a class="button" href="/make/github?choose=1" data-sveltekit-reload>Choose repositories on GitHub</a>
    </p>
  {:else}
    <form
      method="POST"
      action="?/create"
      use:enhance={({ cancel }) => {
        // A second press while the first is out would make a second game.
        if (copying) cancel();
        copying = true;
        return async ({ update }) => {
          await update();
          copying = false;
          await tick();
          focusFirstRefused();
        };
      }}
    >
      <div class="field">
        <label>
          Game files
          <select
            name="repo"
            aria-describedby={describedBy("repo", problems.repo)}
            aria-invalid={problems.repo === undefined ? undefined : "true"}
          >
            <!-- Nothing is chosen for the maker: a repository picked for them is one they might send unseen. -->
            <option value="" selected={!form?.repo}>Choose a repository</option>
            {#each data.repositories as repository (repository.fullName)}
              <option value={repository.fullName} selected={form?.repo === repository.fullName}>
                {repository.fullName}
              </option>
            {/each}
          </select>
        </label>
        <span class="note" id="repo-hint">The GitHub repository with your game's index.html.</span>
        {#if problems.repo !== undefined}
          <span class="problem" id="repo-problem">{problems.repo}</span>
        {/if}
        <a href="/make/github?choose=1" data-sveltekit-reload>Don't see your game? Choose it on GitHub</a>
      </div>
      <div class="field">
        <label>
          Name
          <input
            type="text"
            name="name"
            autocomplete="off"
            value={form?.name}
            aria-describedby={describedBy("name", problems.name)}
            aria-invalid={problems.name === undefined ? undefined : "true"}
          />
        </label>
        <span class="note" id="name-hint">The name players see. Like: Floor Fifty.</span>
        {#if problems.name !== undefined}
          <span class="problem" id="name-problem">{problems.name}</span>
        {/if}
      </div>
      <div class="field">
        <label>
          One line about your game
          <input
            type="text"
            name="oneLine"
            autocomplete="off"
            value={form?.oneLine}
            aria-describedby={describedBy("oneLine", problems.oneLine)}
            aria-invalid={problems.oneLine === undefined ? undefined : "true"}
          />
        </label>
        <span class="note" id="oneLine-hint"
          >Players see it under the name. Like: Climb. Fall. Climb again.</span
        >
        {#if problems.oneLine !== undefined}
          <span class="problem" id="oneLine-problem">{problems.oneLine}</span>
        {/if}
      </div>
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
        <span class="note">Choose Computer only if your game needs a keyboard or a mouse.</span>
      </fieldset>
      <!-- Open again after a refusal when something was typed in it or it was refused, so a person sees it. -->
      <details
        open={Boolean(form?.branch) ||
          Boolean(form?.folder) ||
          problems.branch !== undefined ||
          problems.folder !== undefined}
      >
        <summary>Change the branch or folder</summary>
        <div class="field">
          <label>
            Branch
            <input
              type="text"
              name="branch"
              autocomplete="off"
              value={form?.branch}
              aria-describedby={describedBy("branch", problems.branch)}
              aria-invalid={problems.branch === undefined ? undefined : "true"}
            />
          </label>
          <span class="note" id="branch-hint">Leave empty for your main branch.</span>
          {#if problems.branch !== undefined}
            <span class="problem" id="branch-problem">{problems.branch}</span>
          {/if}
        </div>
        <div class="field">
          <label>
            Folder
            <input
              type="text"
              name="folder"
              autocomplete="off"
              value={form?.folder}
              aria-describedby={describedBy("folder", problems.folder)}
              aria-invalid={problems.folder === undefined ? undefined : "true"}
            />
          </label>
          <span class="note" id="folder-hint">Leave empty if index.html is at the top.</span>
          {#if problems.folder !== undefined}
            <span class="problem" id="folder-problem">{problems.folder}</span>
          {/if}
        </div>
      </details>
      <details open={problems.servers !== undefined}>
        <summary>My game uses other websites</summary>
        <div class="field">
          <label>
            Websites it uses
            <textarea
              name="servers"
              rows="3"
              autocomplete="off"
              aria-describedby={describedBy("servers", problems.servers)}
              aria-invalid={problems.servers === undefined ? undefined : "true"}>{form?.servers}</textarea
            >
          </label>
          <span class="note" id="servers-hint"
            >One per line, like api.example.com. Five at most. Leave this empty if your game runs on its own.</span
          >
          {#if problems.servers !== undefined}
            <span class="problem" id="servers-problem">{problems.servers}</span>
          {/if}
        </div>
      </details>
      {#if form?.error}
        <p class="problem" role="alert">{form.error}</p>
      {/if}
      <button disabled={copying} aria-busy={copying}>
        {copying ? "Copying your game…" : "Save and add videos"}
      </button>
      {#if copying}
        <p>Copying your game from GitHub. This can take a minute. Keep this page open.</p>
      {/if}
    </form>
  {/if}
  <p><a href="/make">Back to your games</a></p>
</main>
