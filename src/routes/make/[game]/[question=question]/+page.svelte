<!--
  One question of a game, on the felt. Which one is the address's last word; each is its own heading, answer and hint.
  The page is keyed on the question, so going from one to the next builds the screen again and each line rises into
  place; going on or back is the layout's (src/routes/make/+layout.svelte).
-->
<script lang="ts">
  import FilesQuestion from "../../parts/FilesQuestion.svelte";
  import Picks from "../../parts/Picks.svelte";
  import QuestionScreen from "../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../parts/TextAnswer.svelte";
  import { providePreview } from "../../parts/preview.svelte.ts";
  import VideoQuestion from "../../parts/VideoQuestion.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const problem = $derived(form?.problem);

  // The card beside the question follows what is typed; the next question starts again from what is saved.
  const preview = providePreview(() => data.preview);
  $effect.pre(() => {
    preview.follow(data.question);
  });

  // The age question's counter: what is saved until a rating is picked, then what that rating makes of the count (an 18+ game
  // is asked its marks too). A page without script keeps the saved count.
  const ageCounter = $derived.by(() => {
    const picked = preview.rating;
    if (data.ageCounters === null || picked === null) return data.counter;
    return picked.startsWith("18+") ? data.ageCounters.eighteen : data.ageCounters.younger;
  });

  const AGES = [
    { value: "age_3", title: "3+", line: "Fine for anyone." },
    { value: "age_7", title: "7+", line: "Cartoon fighting, or a little scary." },
    { value: "age_12", title: "12+", line: "Real-looking fighting, or scary bits." },
    { value: "age_16", title: "16+", line: "More violence or strong words." },
    { value: "age_18", title: "18+", line: "Only for adults." },
  ];

  const MARKS = [
    { value: "sex_or_nudity", title: "Sex or nudity" },
    { value: "gore", title: "Gore" },
    { value: "drugs", title: "Drugs" },
    { value: "none", title: "None of these" },
  ];

  const WEBSITES_HINT =
    "One per line, like api.example.com. Leave this empty if your game runs on its own. Saving copies your game from GitHub again.";
  const NAME_HINT = "The name players see. Like: Floor Fifty.";
  const ADDRESS_STAYS = " Its link on Ruken stays the same, so links you've shared keep working.";
</script>

{#key data.question}
  {#if data.question === "name"}
    <QuestionScreen
      heading="What's your game called?"
      counter={data.counter}
      back={data.back}
      throwAway={data.throwAway}
    >
      <TextAnswer
        name="name"
        previews="name"
        value={form?.value ?? data.name}
        hint={data.addressStays ? NAME_HINT + ADDRESS_STAYS : NAME_HINT}
        {problem}
      />
    </QuestionScreen>
  {:else if data.question === "line"}
    <QuestionScreen
      heading={`What's ${data.name} about, in one line?`}
      counter={data.counter}
      back={data.back}
      throwAway={data.throwAway}
    >
      <TextAnswer
        name="oneLine"
        previews="line"
        grows
        value={form?.value ?? data.oneLine}
        hint="Players see it under the name. Like: Climb. Fall. Climb again."
        {problem}
      />
    </QuestionScreen>
  {:else if data.question === "files" && data.files !== null}
    <FilesQuestion
      files={data.files}
      counter={data.counter}
      back={data.back}
      throwAway={data.throwAway}
      problems={form?.problems}
      asked={form?.asked}
      refusedNow={form?.refusal}
    />
  {:else if (data.question === "upright" || data.question === "wide") && data.video !== null}
    <VideoQuestion
      shape={data.question}
      video={data.video}
      counter={data.counter}
      back={data.back}
      throwAway={data.throwAway}
      {problem}
    />
  {:else if data.question === "websites"}
    <QuestionScreen
      heading={`Does ${data.name} use other websites?`}
      counter={data.counter}
      back={data.back}
      throwAway={data.throwAway}
      enterHint={false}
    >
      <TextAnswer
        name="servers"
        value={form?.value ?? data.servers}
        hint={WEBSITES_HINT}
        lines={3}
        {problem}
      />
    </QuestionScreen>
  {:else if data.question === "age"}
    <QuestionScreen
      heading={`Who is ${data.name} for?`}
      counter={ageCounter}
      back={data.back}
      throwAway={data.throwAway}
    >
      <Picks
        name="ageRating"
        options={AGES}
        chosen={data.ageRating}
        ratings
        hint="We check this when we look at your game."
        {problem}
      />
    </QuestionScreen>
  {:else}
    <QuestionScreen
      heading={`Does ${data.name} have any of these?`}
      counter={data.counter}
      back={data.back}
      throwAway={data.throwAway}
    >
      {#if data.madeEighteen}
        <!-- The game is being made 18+: the rating is kept with its marks, in one answer. -->
        <input type="hidden" name="age" value="18" />
      {/if}
      <Picks
        name="contentMarks"
        options={MARKS}
        chosen={data.contentMarks}
        several
        hint="Only adults will see this game. Sex or nudity is fine here. No game may have pornography or gambling."
        {problem}
      />
    </QuestionScreen>
  {/if}
{/key}
