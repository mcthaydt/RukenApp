<!--
  A game's page in the maker's area. It reads top to bottom as one checklist: where the game stands and the one next
  step, then its files, its two videos, the agreement and Send. Each row is a label, one line of where it stands and
  its one button. Only one button is filled at a time: the first thing still to do (the files when they were refused,
  then each missing video, then Send once everything is in); the rest are quiet. A press that takes time says so in its
  own words and cannot be pressed again. Refusals sit under the thing they are about. A live game's videos cannot be
  changed yet. The way back to the maker's games is the last line.
-->
<script lang="ts">
  import { enhance } from "$app/forms";
  import { tick } from "svelte";
  import { focusFirstRefused } from "../../../lib/focus.ts";
  import Points from "../../legal/maker-agreement/Points.svelte";
  import ClipPicker from "./ClipPicker.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  // True from the press of the copy button, or of Send, until the answer comes: the words on the button and the note
  // about the wait are true only then. Without script the page simply waits.
  let copying = $state(false);
  let sending = $state(false);

  const game = $derived(data.game);
  // The states in which the maker may still change the videos: not live, not taken off or down.
  const working = $derived(["draft", "sent_back", "waiting"].includes(game.state));
  const canSend = $derived(game.state === "draft" || game.state === "sent_back");
  const canPull = $derived(working || game.state === "live");

  // The one filled button: the first thing still to do.
  const filled = $derived.by(() => {
    if (!working) return null;
    if (game.pullProblem !== null) return "files";
    if (!canSend) return null;
    if (game.clips.upright === null) return "upright";
    if (game.clips.wide === null) return "wide";
    return "send";
  });

  /** The server's refusal of a video that was sent, only for the video it is about. */
  const refusalFor = (shape: "upright" | "wide") =>
    form?.clip?.shape === shape ? form.clip.problem : undefined;
</script>

<svelte:head>
  <title>{game.name} · Ruken</title>
</svelte:head>

<main class="card">
  <h1>{game.name}</h1>
  <p class="statement">{game.headline}</p>
  {#if game.reason !== null}
    <p><strong>What to fix</strong></p>
    <p>{game.reason}</p>
  {/if}
  {#if data.nextStep !== null}
    <p>{data.nextStep}</p>
  {/if}
  {#if game.state === "live"}
    <p><a href={`/g/${game.slug}`}>See it on Ruken</a></p>
  {/if}

  <section class="step" aria-labelledby="files-title">
    <p><strong id="files-title">Game files</strong></p>
    {#if game.pullProblem !== null}
      <p>{game.repoFullName}</p>
      <p class="problem" role="alert">{game.pullProblem}</p>
      {#if canPull}
        <p>Fix it on GitHub, then press Copy my game from GitHub again.</p>
      {/if}
    {:else if data.filesLine !== null}
      <p>{game.repoFullName} · {data.filesLine}</p>
    {:else}
      <p>{game.repoFullName}</p>
    {/if}
    {#if canPull}
      <form
        method="POST"
        action="?/pull"
        use:enhance={({ cancel }) => {
          // A second press while the first is out would copy twice.
          if (copying) cancel();
          copying = true;
          return async ({ update }) => {
            await update();
            copying = false;
          };
        }}
      >
        {#if filled === "files"}
          <button disabled={copying} aria-busy={copying}>
            {copying ? "Copying your game…" : "Copy my game from GitHub again"}
          </button>
        {:else}
          <button class="quiet" disabled={copying} aria-busy={copying}>
            {#if copying}
              Copying your game…
            {:else if game.state === "live"}
              Send my newest version for review
            {:else}
              Copy my game from GitHub again
            {/if}
          </button>
        {/if}
        {#if copying}
          <p>Copying your game from GitHub. This can take a minute. Keep this page open.</p>
        {:else if game.state === "waiting"}
          <p class="note">We'll review the newest copy.</p>
        {:else if game.state === "live"}
          <p class="note">Players keep the version they have until we say yes.</p>
        {/if}
      </form>
    {/if}
    <!-- The address matters only to a game that uses other websites, which may ask where a player comes from. -->
    {#if game.connectHosts.length > 0}
      <p>Websites your game uses: {game.connectHosts.join(", ")}</p>
      <p class="note">If one of them asks which address to allow, give it {data.address}.</p>
    {/if}
  </section>

  <div class="step">
    <p>Players see these in the feed before they play.</p>
    <ClipPicker
      shape="upright"
      title="Upright video"
      hint="For phones: taller than wide. MP4 or WebM, up to 30 MB."
      bytes={game.clips.upright}
      canChange={working}
      live={game.state === "live"}
      quiet={filled !== "upright"}
      refusal={refusalFor("upright")}
      missing={form?.missing?.upright === true}
    />
    <ClipPicker
      shape="wide"
      title="Wide video"
      hint="For computers: wider than tall. MP4 or WebM, up to 30 MB."
      bytes={game.clips.wide}
      canChange={working}
      live={game.state === "live"}
      quiet={filled !== "wide"}
      refusal={refusalFor("wide")}
      missing={form?.missing?.wide === true}
    />
    {#if game.state === "live"}
      <p class="note">Videos can't be changed on a live game yet.</p>
    {/if}
  </div>

  {#if canSend}
    <form
      method="POST"
      action="?/send"
      use:enhance={({ cancel }) => {
        // A second press while the first is out would send twice.
        if (sending) cancel();
        sending = true;
        return async ({ update }) => {
          await update();
          sending = false;
          // A refused send takes the maker to the first thing still missing, so a phone scrolls to it.
          await tick();
          focusFirstRefused();
        };
      }}
    >
      {#if !data.agreed}
        <label class="choice">
          <input
            type="checkbox"
            name="agree"
            aria-invalid={form?.missing?.agreement === true ? "true" : undefined}
            aria-describedby={form?.sendProblem ? "send-problem" : undefined}
          />
          <span
            >I've read and agree to the
            <a href={`/legal/maker-agreement?back=${encodeURIComponent(`/make/${game.slug}`)}`}
              >maker agreement</a
            ></span
          >
        </label>
        <details>
          <summary>Read the maker agreement</summary>
          <Points points={data.agreement} />
        </details>
      {/if}
      {#if form?.sendProblem}
        <p class="problem" id="send-problem">{form.sendProblem}</p>
      {/if}
      {#if filled === "send"}
        <button disabled={sending} aria-busy={sending}>
          {sending ? "Sending your game…" : game.state === "sent_back" ? "Send it again" : "Send for review"}
        </button>
      {:else}
        <button class="quiet" disabled={sending} aria-busy={sending}>
          {sending ? "Sending your game…" : game.state === "sent_back" ? "Send it again" : "Send for review"}
        </button>
      {/if}
    </form>
  {/if}
  <p><a href="/make">Back to your games</a></p>
</main>
