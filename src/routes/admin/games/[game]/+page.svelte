<!--
  Checking a game (spec 11.1, screen 2). One form in two halves: on the left the game's name, the one blue button, the game
  itself playing in its frame and how long it has been played; on the right a sheet with each part of the game and a
  box to say it is wrong. The button says Accept until something is ticked and Send back after, by a rule in the look
  and not by script, so the page is right before script wakes and with none. Ticking a part opens its reasons; the
  server decides by what was ticked and never by the button's words. A game that needs a keyboard says so above its frame.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const RATINGS = [
    { value: "age_3", words: "3+" },
    { value: "age_7", words: "7+" },
    { value: "age_12", words: "12+" },
    { value: "age_16", words: "16+" },
    { value: "age_18", words: "18+" },
  ];
  const MARKS = [
    { value: "sex_or_nudity", words: "Sex or nudity" },
    { value: "gore", words: "Gore" },
    { value: "drugs", words: "Drugs" },
    { value: "none", words: "None of these" },
  ];

  /** What was ticked and typed before a refusal, so the page comes back as it was left. */
  const kept = $derived(form?.kept);
  const chosenRating = $derived(
    kept !== undefined && kept.ageRating !== "" ? kept.ageRating : data.ageRating,
  );
  const chosenMarks: readonly string[] = $derived(kept?.marks ?? data.contentMarks);

  let frame = $state<HTMLIFrameElement>();
  // Drawn by script, so with none it is not there: only a browser that can show a frame full screen offers it.
  let canFullScreen = $state(false);
  onMount(() => {
    canFullScreen = document.fullscreenEnabled && frame?.requestFullscreen !== undefined;
  });
</script>

<svelte:head>
  <title>Check {data.name} · Ruken</title>
</svelte:head>

<main>
  <form method="POST" action="?/decide" class="halves">
    <input type="hidden" name="seen" value={data.seen} />
    <div>
      <p class="count">{data.kind === "update" ? "Update" : "Game"} · {data.makerEmail} · {data.waited}</p>
      <h1>{data.name}</h1>
      {#if form?.problem !== undefined}
        <p class="problem" role="alert">{form.problem}</p>
      {/if}
      {#if data.filesBeingFixed !== null && form?.problem === undefined}
        <p class="note">{data.filesBeingFixed}</p>
      {/if}
      <div class="acts">
        <button class="decide"><span data-accept>Accept</span><span data-send-back>Send back</span></button>
      </div>
      {#if data.computerOnly}
        <p class="note">This game needs a keyboard. Connect one to your iPad.</p>
      {/if}
      <iframe
        bind:this={frame}
        class="frame"
        title={`${data.name}, playing`}
        src={data.frame.src}
        sandbox={data.frame.sandbox}
        allow={data.frame.allow}
      ></iframe>
      {#if canFullScreen}
        <button type="button" class="quiet" onclick={() => frame?.requestFullscreen()}>Full size</button>
      {/if}
      <p class="note">{data.played}</p>
      <a class="foot" href="/admin/games">Back to games to check</a>
    </div>
    <div class="sheet">
      {#each data.parts as part (part.part)}
        <section class="part" aria-labelledby={`part-${part.part}`}>
          <h2 id={`part-${part.part}`}>{part.title}</h2>
          {#if part.video !== null}
            <video class="clip" src={part.video.src} controls muted playsinline preload="metadata"></video>
          {:else}
            <p class="say">{part.value ?? "Not answered"}</p>
          {/if}
          {#if part.canTick}
            <div class="picks" data-several>
              <label class="pick">
                <input
                  type="checkbox"
                  name="wrong"
                  value={part.part}
                  aria-label={`This is wrong: ${part.title}`}
                  checked={kept?.ticked.includes(part.part) ?? false}
                />
                <b>This is wrong</b>
              </label>
            </div>
            <div data-reasons>
              <div class="picks">
                {#each part.reasons as reason (reason.code)}
                  <label class="pick">
                    <input
                      type="radio"
                      name={`reason-${part.part}`}
                      value={reason.code}
                      checked={kept?.reasons[part.part] === reason.code}
                    />
                    <b>{reason.words}</b>
                  </label>
                {/each}
              </div>
              <label class="say">
                Add a line of your own, if you want
                <textarea
                  class="answer"
                  name={`note-${part.part}`}
                  maxlength="500"
                  rows="2"
                  aria-label={`Add a line of your own, if you want (${part.title})`}
                  value={kept?.notes[part.part] ?? ""}></textarea>
              </label>
            </div>
          {/if}
        </section>
      {/each}
      <section class="part" aria-labelledby="part-rating">
        <h2 id="part-rating">Age rating</h2>
        <div class="picks" data-ratings>
          {#each RATINGS as rating (rating.value)}
            <label class="pick">
              <input
                type="radio"
                name="ageRating"
                value={rating.value}
                checked={chosenRating === rating.value}
              />
              <b>{rating.words}</b>
            </label>
          {/each}
        </div>
        <div class="picks" data-several data-marks>
          {#each MARKS as mark (mark.value)}
            <label class="pick">
              <input
                type="checkbox"
                name="mark"
                value={mark.value}
                checked={chosenMarks.includes(mark.value)}
              />
              <b>{mark.words}</b>
            </label>
          {/each}
        </div>
      </section>
    </div>
  </form>
</main>
