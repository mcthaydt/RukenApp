<!--
  A game's page in the maker's area. It reads top to bottom as a checklist: files, upright clip, wide clip, agree,
  send. Each line says where it stands, and the last button is the only filled one. Each clip is a form of its own
  (one file, one button) so a refusal sits beside the clip it is about. A clip that is added says so and offers
  "Replace", which folds out the file box: an empty file box beside "Added" reads as a missing clip. A live game's clips
  cannot be changed yet, so its clip lines only say "Added". The way back to the maker's games is the last line.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // True from the press of "Get the newest version from GitHub" until the answer comes: the note about the wait is
  // true only then. Without script the page simply waits and the note is not shown.
  let copying = $state(false);

  const game = $derived(data.game);
  // The states in which the maker may still change the clips and send the game: not live, not taken off or down.
  const working = $derived(["draft", "sent_back", "waiting"].includes(game.state));
  const canSend = $derived(game.state === "draft" || game.state === "sent_back");
  const canPull = $derived(working || game.state === "live");
  const clips = $derived([
    { shape: "upright", label: "Upright clip", added: game.clips.upright },
    { shape: "wide", label: "Wide clip", added: game.clips.wide },
  ]);
</script>

<svelte:head>
  <title>{game.name} · Ruken</title>
</svelte:head>

<main class="card">
  <h1>{game.name}</h1>
  <p class="statement">{game.words}</p>
  {#if game.state === "waiting"}
    <p class="note">Come back here to see when it's live.</p>
  {/if}
  {#if game.state === "live"}
    <p><a href={`/g/${game.slug}`}>See it on Ruken</a></p>
  {/if}

  <h2>Game files</h2>
  {#if game.pullProblem !== null}
    <p class="problem" role="alert">{game.pullProblem}</p>
  {:else if data.filesLine !== null}
    <p>{game.repoFullName} · {data.filesLine}</p>
  {:else}
    <p>{game.repoFullName}</p>
  {/if}
  {#if canPull}
    <form
      method="POST"
      action="?/pull"
      use:enhance={() => {
        copying = true;
        return async ({ update }) => {
          await update();
          copying = false;
        };
      }}
    >
      <button class="quiet">Get the newest version from GitHub</button>
      {#if copying}
        <p class="note">Copying your game can take a minute. Keep this page open.</p>
      {/if}
    </form>
  {/if}
  <!-- The address matters only to a game that uses other websites, which may ask where a player comes from. -->
  {#if game.connectHosts.length > 0}
    <p>Websites your game uses: {game.connectHosts.join(", ")}</p>
    <p class="note">If one of them asks which address to allow, give it {data.address}.</p>
  {/if}

  {#each clips as clip (clip.shape)}
    {#if working}
      <form method="POST" action={`?/clip&shape=${clip.shape}`} enctype="multipart/form-data">
        {#if clip.added}
          <p>{clip.label}</p>
          <p class="note">Added</p>
          <!-- Open again after a refusal, so the refusal is seen beside the file that caused it. -->
          <details open={form?.clip?.shape === clip.shape}>
            <summary>Replace</summary>
            <p>
              <label>
                New {clip.label.toLowerCase()}
                <input type="file" name="clip" accept="video/mp4,video/webm" />
              </label>
            </p>
            <p class="note">A video, up to 30 MB.</p>
            {#if form?.clip?.shape === clip.shape}
              <p class="problem" role="alert">{form.clip.problem}</p>
            {/if}
            <button class="quiet">Upload</button>
          </details>
        {:else}
          <p>
            <label>
              {clip.label}
              <input type="file" name="clip" accept="video/mp4,video/webm" />
            </label>
          </p>
          <p class="note">Not added yet. A video, up to 30 MB.</p>
          {#if form?.clip?.shape === clip.shape}
            <p class="problem" role="alert">{form.clip.problem}</p>
          {/if}
          <button class="quiet">Upload</button>
        {/if}
      </form>
    {:else}
      <p>{clip.label}: {clip.added ? "Added" : "Not added"}</p>
    {/if}
  {/each}

  {#if canSend}
    <form method="POST" action="?/send">
      {#if !data.agreed}
        <label class="choice">
          <input type="checkbox" name="agree" />
          <span
            >I agree to the
            <a href={`/legal/maker-agreement?back=${encodeURIComponent(`/make/${game.slug}`)}`}
              >maker agreement</a
            ></span
          >
        </label>
      {/if}
      {#if form?.sendProblem}
        <p class="problem" role="alert">{form.sendProblem}</p>
      {/if}
      <button>Send for review</button>
    </form>
  {/if}
  <p><a href="/make">Back to your games</a></p>
</main>
