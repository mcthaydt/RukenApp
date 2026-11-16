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
      changing: boolean;
      chosen: string[];
      branch: string;
      folder: string;
      refusal: Refusal | null;
      /** True for a game put back after it was taken off: its files are not on Ruken yet. */
      putBack: boolean;
      connectAddress: string;
      howToAddress: string;
      folderHowToAddress: string;
      changeAddress: string;
      copiesAgain: boolean;
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
  const branch = $derived(asked?.branch ?? files.branch);
  const folder = $derived(asked?.folder ?? files.folder);

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
    {#if files.putBack}
      <p class="note">It stays off Ruken until this is fixed.</p>
    {/if}
  </div>
  <p class="note"><a href={files.folderHowToAddress}>Here's how to set up your game's folder</a></p>
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
    <Picks
      name="repo"
      options={repositories}
      {chosen}
      plain
      hint="Pick the one that is your game."
      problem={problems?.repo}
    />
    {#if files.copiesAgain}
      <p class="note">Next copies your game from GitHub again.</p>
    {/if}
    {@render connectionFailedUnderList()}
    <p class="note">
      <a href={files.connectAddress} data-sveltekit-reload>Don't see your game? Choose it on GitHub</a>
    </p>
    <details open={boxesOpen}>
      <summary>Change the branch or folder</summary>
      <label>
        Branch
        <input
          class="answer"
          type="text"
          name="branch"
          value={branch}
          autocomplete="off"
          aria-describedby={describedBy("branch")}
          aria-invalid={problems?.branch === undefined ? undefined : "true"}
        />
      </label>
      <p class="note" id="branch-hint">Leave empty for your main branch.</p>
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
          value={folder}
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
    {#if refusal !== null}
      {@render refusalCard(refusal)}
    {/if}
    <div class="sheet">
      <p>Ruken can't see any of your games on GitHub yet.</p>
    </div>
    {#snippet forward()}
      {@render connectButton("Choose your games on GitHub")}
    {/snippet}
  </QuestionScreen>
{:else}
  <QuestionScreen heading="Where are your game's files?" {counter} {back} {throwAway}>
    {@render connectionFailedLine()}
    {#if refusal !== null}
      {@render refusalCard(refusal)}
    {/if}
    <div class="sheet">
      <p class="say">Your game lives on GitHub. Connect it, then pick your game.</p>
      <p class="note">You choose which games on GitHub Ruken can see. It can't see anything else.</p>
    </div>
    <p class="note">
      New to GitHub? <a href={files.howToAddress}>Here's how to put your game there</a>
    </p>
    {#snippet forward()}
      {@render connectButton("Connect GitHub")}
    {/snippet}
  </QuestionScreen>
{/if}
