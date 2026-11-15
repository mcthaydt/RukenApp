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

  const PLAYS_ON = [
    { value: "phone_and_computer", title: "Phones and computers" },
    {
      value: "computer_only",
      title: "Computers only",
      line: "Choose this if your game needs a keyboard or a mouse.",
    },
  ];

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

  const WEBSITES_HINT = "One per line, like api.example.com. Leave this empty if your game runs on its own.";
  const NAME_HINT = "The name players see. Like: Floor Fifty.";
  const ADDRESS_STAYS = " Its address on Ruken stays the same, so links you've shared keep working.";
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
      busyWords="Copying your game…"
      busyLine="Copying your game can take a minute. Keep this page open."
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
  {:else if data.question === "plays-on"}
    <QuestionScreen
      heading={`Where does ${data.name} play?`}
      counter={data.counter}
      back={data.back}
      throwAway={data.throwAway}
    >
      <Picks name="playsOn" options={PLAYS_ON} chosen={data.playsOn} {problem} />
    </QuestionScreen>
  {:else if data.question === "age"}
    <QuestionScreen
      heading={`Who is ${data.name} for?`}
      counter={data.counter}
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
