<!--
  Checking a game (spec 11.1, screen 2). One form in two halves: on the left the game's name, the one blue button, the game
  itself playing in its frame and how long it has been played; on the right a sheet with each part of the game and a
  box to say it is wrong. The button says Accept until something is ticked and Send back after, by a rule in the look
  and not by script, so the page is right before script wakes and with none. Ticking a part opens its reasons; the
  server decides by what was ticked and never by the button's words. A game that needs a keyboard says so above its frame.

  The hidden "seen" field sits inside the left half, so the left half is the form's first child: the look keeps that child
  in view while the sheet scrolls, and the blue button stays in the window.

  Who it's for is one part, whose section holds both things staff can do about it: pick the age themselves, or tick it
  and send it back so the maker chooses again. Each says which it is. A part an update cannot be sent back for says why,
  so staff do not look for a box that is not there.

  A refusal that is about one part (no reason picked, Something else with no line, an 18+ game with no marks) names the part,
  says so again inside it, and the page opens at it, so nobody scrolls a long page looking for what they ticked. Inside the
  part the refusal wears the look's "needs fixing" edge, so it is not read as the part's own words; for the marks it is
  under their question, right above the four boxes it is about. Everything that can refuse an Accept refuses it before
  "Accept it anyway?" is asked, which comes first only when the press would otherwise go through, and the blue button then says so. The line about how long staff have
  played is read again while they play (and when they come back to the page), so it never says "yet" after they have.
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

  /** The part a refusal is about, with the words to find it by. */
  const refusedPart = $derived(data.parts.find((part) => part.part === form?.at));

  // How long staff have played, as the server counted it when the page was drawn, and as it counts it since. The frame's
  // heartbeats reach the server by themselves, so the page asks again, as often as the frame beats.
  let playedSince = $state<string | null>(null);
  const played = $derived(playedSince ?? data.played);
  const REREAD_PLAYED_EVERY_MS = 15_000;

  async function rereadPlayed(): Promise<void> {
    if (document.visibilityState !== "visible") return;
    try {
      const response = await fetch(`/admin/games/${data.slug}/played`);
      if (!response.ok) return;
      const body: unknown = await response.json();
      if (typeof body === "object" && body !== null && "played" in body && typeof body.played === "string")
        playedSince = body.played;
    } catch {
      // Offline for a moment: the line stays as it was and is read again at the next beat.
    }
  }

  /**
   * Opens the page at what a refusal is about: the marks' question, or the part's name. The lines of the page rise into
   * place as it opens, and a line that is still moving is measured where it is, not where it will be, so the page is
   * brought to the place once more when the rising is done.
   */
  function openAtRefusal(): void {
    const refusal = form;
    if (refusal?.at === undefined) return;
    const id = refusal.atMarks ? "marks-question" : `part-${refusal.at}`;
    const target = () => document.getElementById(id)?.scrollIntoView();
    target();
    void Promise.allSettled(document.getAnimations().map((one) => one.finished)).then(target);
  }

  let frame = $state<HTMLIFrameElement>();
  // Drawn by script, so with none it is not there: only a browser that can show a frame full screen offers it.
  let canFullScreen = $state(false);
  onMount(() => {
    canFullScreen = document.fullscreenEnabled && frame?.requestFullscreen !== undefined;
    // A refusal about one part opens the page at it; without script the link beside the words does the same.
    openAtRefusal();
    const timer = setInterval(() => void rereadPlayed(), REREAD_PLAYED_EVERY_MS);
    // Coming back to the tab after playing in another window or app: the line is right at once, not at the next beat.
    const comeBack = () => void rereadPlayed();
    document.addEventListener("visibilitychange", comeBack);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", comeBack);
    };
  });
</script>

<svelte:head>
  <title>Check {data.name} · Ruken</title>
</svelte:head>

<main>
  <form method="POST" action="?/decide" class="halves" data-check>
    <div>
      <input type="hidden" name="seen" value={data.seen} />
      <!-- Said once: after "Accept it anyway?" the next press does not ask again. -->
      {#if kept?.anyway === true}
        <input type="hidden" name="acceptAnyway" value="1" />
      {/if}
      <!-- "Waiting 3 hours" is never cut, a dot stays with the words after it, and an email that does not fit moves down
           whole instead of breaking at a hyphen. -->
      <p class="count facts">
        <span class="nobreak">{data.kind === "update" ? "Update to a live game" : "Game"}</span>
        <span class="email">·&nbsp;{data.makerEmail}</span> ·&nbsp;<span class="nobreak">{data.waited}</span>
      </p>
      <h1>{data.name}</h1>
      <!-- What stops Accept is read before the button is pressed, so it is drawn as a refusal is, and not as a quiet note. -->
      {#if form?.problem !== undefined}
        <p class="problem" role="alert">{form.problem}</p>
        {#if refusedPart !== undefined}
          <p><a class="quiet" href={`#part-${refusedPart.part}`}>Go to {refusedPart.title}</a></p>
        {/if}
      {/if}
      {#if data.filesBeingFixed !== null}
        <p class="problem">{data.filesBeingFixed}</p>
        <p class="note instruction">Look at each part. Tick what's wrong, then press Send back.</p>
      {:else}
        <p class="note instruction">
          Play it and look at each part. Tick anything that's wrong, then press the blue button.
        </p>
      {/if}
      <div class="acts">
        <!-- A game whose files are being fixed cannot be accepted, so its button only ever says Send back. -->
        <button class="decide" data-sends-only={data.filesBeingFixed === null ? undefined : ""}>
          <span data-accept>{form?.asking === true ? "Accept it anyway" : "Accept"}</span><span data-send-back
            >Send back</span
          >
        </button>
      </div>
      {#if data.computerOnly}
        <p class="note">This game needs a keyboard. If you're on an iPad or phone, connect one.</p>
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
      <p class="note">{played}</p>
      <a class="foot" href="/admin/games">Back to games to check</a>
    </div>
    <div class="sheet">
      {#each data.parts as part (part.part)}
        <section class="part" aria-labelledby={`part-${part.part}`}>
          <h2 id={`part-${part.part}`}>{part.title}</h2>
          {#if form?.at === part.part && !form.atMarks}
            <p class="problem">{form.problem}</p>
          {/if}
          {#if part.video !== null}
            <video
              class="clip"
              data-shape={part.video.shape}
              src={part.video.src}
              controls
              muted
              playsinline
              preload="metadata"
            ></video>
          {:else if part.part !== "age_rating"}
            <p class="say">{part.value ?? "Not answered"}</p>
          {/if}
          {#if part.part === "age_rating"}
            <!-- The maker's pick is said once, here: it is also the age that starts out picked below. -->
            <p class="note" id="age-pick">
              {part.value === null ? "The maker hasn't picked one." : `The maker picked ${part.value}.`} Pick who
              it's for.
            </p>
            <div class="picks" data-ratings role="radiogroup" aria-labelledby="age-pick">
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
            <div data-marks>
              <p class="say" id="marks-question">Does {data.name} have any of these?</p>
              {#if form?.at === part.part && form.atMarks}
                <p class="problem">{form.problem}</p>
              {/if}
              <div class="picks" data-several role="group" aria-labelledby="marks-question">
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
            </div>
          {/if}
          {#if !part.canTick}
            <p class="note">This game is already live, so you can't send it back for this part.</p>
          {:else}
            {#if part.part === "age_rating"}
              <!-- Next to its box, so the box is read as this and not as one more mark above it. -->
              <p class="note">Or send it back, and the maker will choose again.</p>
            {/if}
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
              <p class="note">Pick one.</p>
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
              <label class="note">
                Add a line of your own. You need one if you picked Something else.
                <textarea
                  class="answer"
                  name={`note-${part.part}`}
                  maxlength="500"
                  rows="2"
                  aria-label={`Add a line of your own (${part.title})`}
                  value={kept?.notes[part.part] ?? ""}></textarea>
              </label>
            </div>
          {/if}
        </section>
      {/each}
      <!-- Where staff finish reading on a phone or an upright tablet: the way back from the foot of a long page. -->
      <a class="foot" data-end href="/admin/games">Back to games to check</a>
    </div>
  </form>
</main>
