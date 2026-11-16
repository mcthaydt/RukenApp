<!--
  Checking a game (spec 11.1, screen 2), asked the way the maker's screens ask: on the felt, with the counter and the track,
  Back and one blue button, through the maker's own pieces (QuestionScreen and Picks). Two screens and no more:
    1. Check: the game playing in its frame, then every part of it in one list, each with the maker's answer and a box to say
       it is wrong. A ticked part asks why.
    2. The decision: who it's for (the age, the marks of an 18+ game, and a way to send it back for the age instead of
       choosing one), and the blue button, which says Accept until something is ticked and Send back after.

  It is one form, so what staff ticked is sent in one press, and the server decides by what was ticked and never by the
  button's words or by which screen was showing. Without script both screens are on the page at once, with the one blue
  button at the foot, and the page is as right as it was; script only shows one at a time.

  A refusal that is about one part (no reason picked, Something else with no line, an 18+ game with no marks) opens the
  page at that screen and at that part, and says so inside it, in the look's "needs fixing" edge, so it is not read as the
  part's own words; the marks' refusal sits right above the four boxes it is about. Everything that can refuse an Accept
  refuses it before "Accept it anyway?" is asked, which comes first only when the press would otherwise go through, and the
  blue button then says so. The line about how long staff have played is read again while they play (and when they come
  back to the page), so it never says "yet" after they have.

  A part an update cannot be sent back for says why, so staff do not look for a box that is not there. A game that needs a
  keyboard says so above its frame.
-->
<script lang="ts">
  import { refreshAll } from "$app/navigation";
  import { onMount, tick, untrack } from "svelte";
  import Picks from "../../../make/parts/Picks.svelte";
  import QuestionScreen from "../../../make/parts/QuestionScreen.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const RATINGS = [
    { value: "age_3", title: "3+" },
    { value: "age_7", title: "7+" },
    { value: "age_12", title: "12+" },
    { value: "age_16", title: "16+" },
    { value: "age_18", title: "18+" },
  ];
  const MARKS = [
    { value: "sex_or_nudity", title: "Sex or nudity" },
    { value: "gore", title: "Gore" },
    { value: "drugs", title: "Drugs" },
    { value: "none", title: "None of these" },
  ];

  /** What was ticked and typed before a refusal, so the page comes back as it was left. */
  const kept = $derived(form?.kept);

  // What was ticked, as it changes: the last screen says how many parts are wrong, and the page is as it was left after a
  // refusal until a tick changes it.
  let tickedNow = $state<string[] | null>(null);
  const ticked: readonly string[] = $derived(tickedNow ?? kept?.ticked ?? []);
  const rating = $derived(
    kept !== undefined && kept.ageRating !== "" ? kept.ageRating : (data.ageRating ?? ""),
  );
  const chosenMarks: readonly string[] = $derived(kept?.marks ?? data.contentMarks);

  /** A tick anywhere in the form: the last screen follows it. */
  function changed(event: Event): void {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.name !== "wrong") return;
    tickedNow = input.checked ? [...ticked, input.value] : ticked.filter((part) => part !== input.value);
  }

  const agePart = $derived(data.parts.find((part) => part.part === "age_rating"));
  const otherParts = $derived(data.parts.filter((part) => part.part !== "age_rating"));

  const STEPS = ["check", "decide"] as const;
  const HEADINGS = $derived({
    check: `Check ${data.name}`,
    decide: `Decide on ${data.name}`,
  });

  // Script shows one screen at a time; until it wakes (and with none) every screen is on the page.
  let ready = $state(false);
  let here = $state(0);
  const stepId = $derived(STEPS[Math.min(here, STEPS.length - 1)] ?? "check");
  const last = $derived(here >= STEPS.length - 1);
  /** Whether a screen is on the page now. The others stay in the form, hidden, so what was ticked on them is sent. */
  const showing = (id: (typeof STEPS)[number]): boolean => !ready || stepId === id;

  /** The part a refusal is about, to find its place by. */
  const refusedPart = $derived(data.parts.find((part) => part.part === form?.at));

  /** Staff press Next: the next screen, unless this is the last, which is the decision and is sent. */
  function beforeSend(): boolean {
    if (!ready || last) return true;
    here += 1;
    window.scrollTo(0, 0);
    return false;
  }

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

  // A refusal opens the page at what it is about: the list for a part on it (scrolled to that part), or the decision
  // with the age and its marks. The screens are read without being watched, so the page stays where
  // staff are when something else changes under it.
  $effect(() => {
    const refusal = form;
    if (!ready || refusal === null) return;
    const part = refusal.at;
    // The age and its marks are asked with the decision; every other part is on the list.
    const wanted = part === undefined || part === "age_rating" ? "decide" : "check";
    here = STEPS.indexOf(wanted);
    if (part !== undefined && part !== "age_rating")
      void tick().then(() => document.getElementById(`part-${part}`)?.scrollIntoView());
  });

  // A game that changed while staff looked is read again where they are: a refused action does not run the page's load, so
  // without this the page would keep the old `seen` and the old answers, and every press after would be refused again.
  // What was ticked was ticked for what they saw before, so the ticks start again.
  // The decision is not left in front of them with Accept ready: the first screen opens at the top, and a line there says
  // which part changed, found by what each part said before and after the page read the game again.
  let changedLine = $state<string | null>(null);
  /** "One line", "One line and Name", "One line, Name and Game files". */
  const listOf = (titles: string[]): string =>
    titles.length < 2 ? (titles[0] ?? "") : `${titles.slice(0, -1).join(", ")} and ${titles.at(-1) ?? ""}`;
  const signOfPart = (part: (typeof data.parts)[number]): string =>
    JSON.stringify([part.value, part.video?.src ?? null]);
  $effect(() => {
    if (form?.stale !== true) {
      changedLine = null;
      return;
    }
    tickedNow = [];
    const before = new Map(untrack(() => data.parts).map((part) => [part.part, signOfPart(part)]));
    void refreshAll().then(() => {
      const titles = data.parts
        .filter((part) => before.get(part.part) !== signOfPart(part))
        .map((part) => part.title);
      changedLine =
        titles.length === 0
          ? "This game changed while you were looking. Look again."
          : `The maker changed ${listOf(titles)} while you were looking. Look at it again.`;
      here = 0;
      window.scrollTo(0, 0);
    });
  });

  let frame = $state<HTMLIFrameElement>();
  // Drawn by script, so with none it is not there: only a browser that can show a frame full screen offers it.
  let canFullScreen = $state(false);
  let saving = $state(false);
  onMount(() => {
    canFullScreen = document.fullscreenEnabled && frame?.requestFullscreen !== undefined;
    ready = true;
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

<svelte:window onchange={changed} />

{#snippet tickBox(part: (typeof data.parts)[number])}
  {#if !part.canTick}
    <p class="note">This game is already live, so you can't send it back for this part.</p>
  {:else}
    <Picks
      name="wrong"
      several
      labelledBy={`title-${part.part}`}
      options={[
        {
          value: part.part,
          title: part.part === "age_rating" ? "The maker's age pick is wrong" : "This is wrong",
        },
      ]}
      chosen={ticked}
      problem={undefined}
    />
    <div data-reasons>
      <p class="note" id={`why-${part.part}`}>Pick one.</p>
      <Picks
        name={`reason-${part.part}`}
        labelledBy={`why-${part.part}`}
        options={part.reasons.map((reason) => ({ value: reason.code, title: reason.words }))}
        chosen={[kept?.reasons[part.part] ?? ""]}
        problem={undefined}
      />
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
{/snippet}

<QuestionScreen
  heading={ready ? HEADINGS[stepId] : HEADINGS.check}
  counter={ready ? { n: here + 1, of: STEPS.length } : null}
  unit="Step"
  back="/admin/games"
  onBack={ready && here > 0 ? () => (here -= 1) : undefined}
  action="?/decide"
  title={`Check ${data.name}`}
  card={false}
  {beforeSend}
  bind:saving
>
  <input type="hidden" name="seen" value={data.seen} />
  <!-- Said once: after "Accept it anyway" the next press does not ask again. -->
  {#if kept?.anyway === true}
    <input type="hidden" name="acceptAnyway" value="1" />
  {/if}

  <section data-step="check" hidden={!showing("check")}>
    {#if changedLine !== null}
      <p class="problem" role="alert">{changedLine}</p>
    {/if}
    <!-- "Waiting 3 hours" is never cut, a dot stays with the words after it, and an email that does not fit moves down
         whole instead of breaking at a hyphen. -->
    <p class="note facts">
      <span class="nobreak">{data.kind === "update" ? "Update to a live game" : "Game"}</span>
      <span class="email">·&nbsp;{data.makerEmail}</span> ·&nbsp;<span class="nobreak">{data.waited}</span>
    </p>
    {#if data.filesBeingFixed !== null}
      <p class="problem">{data.filesBeingFixed}</p>
    {/if}
    <p class="instruction">Play it, then look at each part. Tick anything that's wrong.</p>
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
    {#each otherParts as part (part.part)}
      <div class="part" id={`part-${part.part}`}>
        <h2 id={`title-${part.part}`}>{part.title}</h2>
        {#if form?.at === part.part}
          <p class="problem" role="alert">{form.problem}</p>
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
        {:else}
          <p class="say">{part.value ?? "Not answered"}</p>
          {#if part.hint !== null}
            <p class="note">{part.hint}</p>
          {/if}
        {/if}
        {@render tickBox(part)}
      </div>
    {/each}
  </section>

  <section data-step="decide" hidden={!showing("decide")}>
    {#if agePart !== undefined}
      <div class="part" id="part-age_rating">
        {#if form?.at === "age_rating" && !form.atMarks}
          <p class="problem" role="alert">{form.problem}</p>
        {/if}
        <h2 id="age-question">Who is {data.name} for?</h2>
        <!-- The maker's pick is said once, here: it is also the age that starts out picked below. -->
        <p class="note">
          {agePart.value === null ? "The maker hasn't picked one." : `The maker picked ${agePart.value}.`} Pick
          who it's for.
        </p>
        <Picks
          name="ageRating"
          labelledBy="age-question"
          options={RATINGS}
          chosen={[rating]}
          ratings
          problem={undefined}
        />
        <!-- The marks of an 18+ game: the look hides them until 18+ is picked, by a rule and not by script. -->
        <div data-marks>
          <p class="say" id="marks-question">Does {data.name} have any of these?</p>
          {#if form?.at === "age_rating" && form.atMarks}
            <p class="problem" role="alert">{form.problem}</p>
          {/if}
          <Picks
            name="mark"
            several
            labelledBy="marks-question"
            options={MARKS}
            chosen={chosenMarks}
            problem={undefined}
          />
        </div>
        {#if agePart.canTick}
          <!-- Next to its box, so the box is read as this and not as one more mark above it. -->
          <p class="note" id="title-age_rating">Or send it back, and the maker will choose again.</p>
        {/if}
        {@render tickBox(agePart)}
      </div>
    {/if}
    {#if form?.problem !== undefined && (form.at === undefined || refusedPart === undefined)}
      <p class="problem" role="alert">{form.problem}</p>
    {/if}
    {#if data.filesBeingFixed !== null}
      <p class="problem">{data.filesBeingFixed}</p>
    {/if}
    {#if !ready}
      <p class="note">Nothing ticked: press Accept. Anything ticked: press Send back.</p>
    {:else if form?.asking === true}
      <!-- Asked to accept anyway: the question above says it all, and a line saying nothing is wrong would say the
           opposite of the button. -->
    {:else if ticked.length === 0 && data.filesBeingFixed === null}
      <p class="say">Nothing is wrong. Press Accept, and {data.name} goes live.</p>
    {:else}
      <p class="say">
        {ticked.length === 1 ? "One part is wrong." : `${String(ticked.length)} parts are wrong.`} Press Send back,
        and the maker sees why.
      </p>
    {/if}
  </section>

  {#snippet forward()}
    {#if !ready || last}
      <!-- A game whose files are being fixed cannot be accepted, so its button only ever says Send back. -->
      <button
        class="decide"
        disabled={saving}
        data-sends-only={data.filesBeingFixed === null ? undefined : ""}
      >
        <span data-accept>{form?.asking === true ? "Accept it anyway" : "Accept"}</span><span data-send-back
          >Send back</span
        >
      </button>
    {:else}
      <button disabled={saving}>Next</button>
    {/if}
  {/snippet}
</QuestionScreen>
