<!--
  A game's page in the maker's area. It reads top to bottom as a checklist: files, upright clip, wide clip, agree,
  send. Each line says where it stands, and the last button is the only filled one. Each clip is a form of its own
  (one file, one button) so a refusal sits beside the clip it is about. A live game's clips cannot be changed yet, so
  its clip lines only say "Added".
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

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
    <form method="POST" action="?/pull">
      <button class="quiet">Pull the latest</button>
      <p class="note">Copying your game can take a minute. Keep this page open.</p>
    </form>
  {/if}
  <p class="note">
    Your game runs at {data.address}. If your game's server checks where players come from, allow this
    address.
  </p>
  {#if game.connectHosts.length > 0}
    <p class="note">Talks to: {game.connectHosts.join(", ")}</p>
  {/if}

  {#each clips as clip (clip.shape)}
    {#if working}
      <form method="POST" action={`?/clip&shape=${clip.shape}`} enctype="multipart/form-data">
        <p>
          <label>
            {clip.label}
            <input type="file" name="clip" accept="video/mp4,video/webm" />
          </label>
        </p>
        <p class="note">{clip.added ? "Added" : "Not added yet. A video, up to 30 MB."}</p>
        {#if form?.clip?.shape === clip.shape}
          <p class="problem" role="alert">{form.clip.problem}</p>
        {/if}
        <button class="quiet">Upload</button>
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
          <span>I agree to the <a href="/legal/maker-agreement">maker agreement</a></span>
        </label>
      {/if}
      {#if form?.sendProblem}
        <p class="problem" role="alert">{form.sendProblem}</p>
      {/if}
      <button>Send for review</button>
    </form>
  {/if}
</main>
