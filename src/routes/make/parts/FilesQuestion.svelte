<!--
  "Where are your game's files?" (question 3). GitHub is the only way in, so this question is five screens in one place,
  by what Ruken knows about the maker: GitHub not connected (one sheet and Connect GitHub), connected with nothing
  chosen on GitHub (one way to choose some), connected (Ruken's own rows to choose from, and Next copies the game), and
  a copy that was refused (a "Needs fixing" card, and the one blue button opens the boxes that fix it). The rows are
  drawn by Ruken, never the browser's list, and nothing is chosen for the maker. A connection that failed says so on the
  three screens she can come back to after "Choose it on GitHub": not connected, nothing chosen, and the rows.
-->
<script lang="ts">
  import Picks from "./Picks.svelte";
  import QuestionScreen from "./QuestionScreen.svelte";

  interface Refusal {
    missingIndex: boolean;
    words: string;
  }
  type Box = "repo" | "branch" | "folder";

  let {
    files,
    counter,
    back,
    throwAway,
    problems,
    asked,
    refusedNow,
  }: {
    files: {
      connected: boolean;
      repositories: string[];
      connectionFailed: boolean;
      /** Just back from GitHub's sign-in, with the list Ruken keeps looked up again. */
      looked: boolean;
      changing: boolean;
      chosen: string[];
      branch: string;
      /** The branches of the chosen game, when GitHub answered; empty otherwise. */
      branches: string[];
      branchesAddress: string;
      folder: string;
      refusal: Refusal | null;
      connectAddress: string;
      howToAddress: string;
      folderHowToAddress: string;
      changeAddress: string;
      copiesAgain: boolean;
      sendsForReview: boolean;
      keepsChoice: boolean;
    };
    counter: { n: number; of: number } | null;
    back: string;
    throwAway: string | undefined;
    /** The words for each box that was refused, from the answer just sent. */
    problems: Partial<Record<Box, string>> | undefined;
    /** What was typed in the answer just sent, which comes back with a refusal. */
    asked: { repo: string; branch: string; folder: string } | undefined;
    /** The copy refused by the answer just sent: the page has not been loaded again, so it is not in `files`. */
    refusedNow: Refusal | undefined;
  } = $props();

  const refusal = $derived(refusedNow ?? files.refusal);
  const repositories = $derived(files.repositories.map((name) => ({ value: name, title: name })));
  const chosen = $derived(asked === undefined ? files.chosen : asked.repo === "" ? [] : [asked.repo]);
  // Ticking a different game than the one the branch was for clears it to the main branch: another game may not have it.
  let otherGameTicked = $state(false);
  const branch = $derived(otherGameTicked ? "" : (asked?.branch ?? files.branch));
  const folder = $derived(asked?.folder ?? files.folder);
  // The folder box is bound, never set: a set value is written over a folder typed before the page came alive.
  let folderBox = $derived(folder);

  // The branches to pick from belong to the game that is ticked, so ticking another game fetches its own. The main
  // branch is always on the list and is the empty answer, so nothing here can make a game that cannot be copied.
  let fetched = $state<{ repo: string; names: string[] } | undefined>(undefined);
  // The game whose branches GitHub is being asked for, while the answer is out: the screen says so.
  let lookingUp = $state<string | null>(null);
  const savedRepo = $derived(files.chosen[0] ?? "");
  const branchNames = $derived(fetched === undefined ? files.branches : fetched.names);
  // A branch that was typed or saved stays on the list even when GitHub no longer lists it, so what she sees is what she sent.
  const branchChoices = $derived(
    branch === "" || branchNames.includes(branch) ? branchNames : [branch, ...branchNames],
  );

  async function repoTicked(event: Event): Promise<void> {
    const ticked = event.target;
    if (!(ticked instanceof HTMLInputElement) || ticked.name !== "repo") return;
    const repo = ticked.value;
    otherGameTicked = repo !== (asked?.repo ?? savedRepo);
    if (repo === savedRepo) {
      lookingUp = null;
      fetched = undefined;
      return;
    }
    lookingUp = repo;
    try {
      const response = await fetch(`${files.branchesAddress}?repo=${encodeURIComponent(repo)}`);
      const body: unknown = await response.json();
      const names = Array.isArray(body)
        ? body.filter((name): name is string => typeof name === "string")
        : [];
      // Ticking another game while this answer was on its way: the answer is for a game no longer ticked.
      if (ticked.form?.querySelector<HTMLInputElement>('input[name="repo"]:checked')?.value === repo) {
        fetched = { repo, names };
      }
    } catch {
      if (ticked.form?.querySelector<HTMLInputElement>('input[name="repo"]:checked')?.value === repo) {
        fetched = { repo, names: [] };
      }
    } finally {
      if (lookingUp === repo) lookingUp = null;
    }
  }

  // The boxes for another branch or folder are open when she asked for them, or when they were typed in or refused,
  // so what she sees is what she sent.
  const boxesOpen = $derived(
    files.changing ||
      branch !== "" ||
      folder !== "" ||
      problems?.branch !== undefined ||
      problems?.folder !== undefined,
  );

  /** Which of the five screens this is. A refusal stands until "Pick another" opens the boxes. */
  const screen = $derived(
    !files.connected
      ? "connect"
      : files.repositories.length === 0
        ? "choose"
        : refusal !== null && !files.changing
          ? "refused"
          : "pick",
  );

  const describedBy = (box: Box) =>
    problems?.[box] === undefined ? `${box}-hint` : `${box}-hint ${box}-problem`;
</script>

{#snippet connectButton(words: string)}
  <!-- A server redirect to GitHub, not a page: the browser must ask the server. -->
  <a class="button" href={files.connectAddress} data-sveltekit-reload>{words}</a>
{/snippet}

{#snippet connectionFailedLine()}
  {#if files.connectionFailed}
    <p class="problem" role="alert">GitHub didn't connect. Try again.</p>
  {/if}
{/snippet}

<!-- With a list to pick from there is no Connect button to try again with, so the line says what still works. It sits
     under the hint, where every other refusal does. -->
{#snippet connectionFailedUnderList()}
  {#if files.connectionFailed}
    <p class="problem" role="alert">GitHub didn't connect. You can still pick a game from the list.</p>
  {/if}
{/snippet}

{#snippet refusalCard(shown: Refusal)}
  <div class="sheet fix">
    <b class="fixlabel">Needs fixing</b>
    <b class="statement">We couldn't start your game</b>
    <p>
      {shown.missingIndex
        ? `Ruken starts your game from a file called index.html. We couldn't find one in ${chosen[0] ?? "that folder"}.`
        : shown.words}
    </p>
  </div>
  <p class="note">
    <a class="quiet" href={files.folderHowToAddress}>Here's how to set up your game's folder</a>
  </p>
{/snippet}

{#if screen === "pick"}
  <QuestionScreen
    heading="Where are your game's files?"
    {counter}
    {back}
    {throwAway}
    busyWords="Copying your game…"
    busyLine="Copying your game can take a minute. Keep this page open."
  >
    {#if refusal !== null}
      {@render refusalCard(refusal)}
    {/if}
    <div onchange={repoTicked} role="presentation">
      <Picks
        name="repo"
        options={repositories}
        {chosen}
        plain
        hint="Pick the one that is your game."
        problem={problems?.repo}
      />
    </div>
    {#if lookingUp !== null}
      <p class="note" role="status" aria-busy="true">Looking up branches…</p>
    {/if}
    {#if files.sendsForReview}
      <p class="note">
        Save copies your game from GitHub and sends it for review. Players can still play it while you wait.
      </p>
    {:else if files.copiesAgain}
      <p class="note">Next copies your game from GitHub again.</p>
    {:else if files.keepsChoice}
      <p class="note">Save keeps your choice. Put it back on Ruken copies your game from GitHub.</p>
    {/if}
    {@render connectionFailedUnderList()}
    {#if files.looked}
      <p class="note">
        Ruken looked on GitHub again. Still not there? Press the link below to add it on GitHub.
      </p>
    {/if}
    <p class="note">
      <a class="quiet" href={files.connectAddress} data-sveltekit-reload
        >Don't see your game? Choose it on GitHub</a
      >
    </p>
    <details open={boxesOpen}>
      <summary>Change the branch or folder</summary>
      <label>
        <span id="branch-label">Branch</span>
        <select
          class="answer"
          aria-labelledby="branch-label"
          name="branch"
          aria-describedby={describedBy("branch")}
          aria-invalid={problems?.branch === undefined ? undefined : "true"}
        >
          <option value="" selected={branch === ""}>Main branch</option>
          {#each branchChoices as name (name)}
            <option value={name} selected={name === branch}>{name}</option>
          {/each}
        </select>
      </label>
      <p class="note" id="branch-hint">Pick the branch your game is on. Main branch is the usual one.</p>
      {#if problems?.branch !== undefined}
        <p class="problem" id="branch-problem" role="alert">{problems.branch}</p>
      {/if}
      <label>
        Folder
        <!-- Opened by "Pick another": the keyboard goes straight to the box that was wrong. -->
        <!-- svelte-ignore a11y_autofocus -->
        <input
          class="answer"
          type="text"
          name="folder"
          bind:value={folderBox}
          autocomplete="off"
          autofocus={files.changing}
          aria-describedby={describedBy("folder")}
          aria-invalid={problems?.folder === undefined ? undefined : "true"}
        />
      </label>
      <p class="note" id="folder-hint">Leave empty if index.html isn't inside a folder.</p>
      {#if problems?.folder !== undefined}
        <p class="problem" id="folder-problem" role="alert">{problems.folder}</p>
      {/if}
    </details>
  </QuestionScreen>
{:else if screen === "refused" && refusal !== null}
  <QuestionScreen heading="Where are your game's files?" {counter} {back} {throwAway}>
    {@render refusalCard(refusal)}
    {#snippet forward()}
      <a class="button" href={files.changeAddress}>Pick another</a>
    {/snippet}
  </QuestionScreen>
{:else if screen === "choose"}
  <QuestionScreen heading="Where are your game's files?" {counter} {back} {throwAway}>
    {@render connectionFailedLine()}
    <div class="sheet">
      {#if files.looked}
        <p>
          Ruken looked on GitHub again and still can't see your games. Press Choose on GitHub to add them
          there.
        </p>
      {:else}
        <p>Ruken can't see any of your games on GitHub yet.</p>
      {/if}
    </div>
    {#snippet forward()}
      {@render connectButton("Choose on GitHub")}
    {/snippet}
  </QuestionScreen>
{:else}
  <QuestionScreen heading="Where are your game's files?" {counter} {back} {throwAway}>
    {@render connectionFailedLine()}
    <div class="sheet">
      <p class="say">Your game lives on GitHub. Connect it, then pick your game.</p>
      <p class="note">You choose which games on GitHub Ruken can see. It can't see anything else.</p>
    </div>
    <p class="note">
      New to GitHub? <a class="quiet" href={files.howToAddress}>Here's how to put your game there</a>
    </p>
    {#snippet forward()}
      {@render connectButton("Connect GitHub")}
    {/snippet}
  </QuestionScreen>
{/if}
