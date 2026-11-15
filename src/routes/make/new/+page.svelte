<!--
  Question 1 of a game that does not exist yet: its name. Next makes the game and goes on to its one line. Back is Your
  games. Nothing is saved before the name is given, so there is nothing to throw away yet.
-->
<script lang="ts">
  import QuestionScreen from "../parts/QuestionScreen.svelte";
  import { providePreview } from "../parts/preview.svelte.ts";
  import TextAnswer from "../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();

  // Nothing is saved yet, so the card beside the question fills in as the name is typed.
  providePreview(() => ({ name: "", oneLine: "", rating: null, video: null, wideVideo: null }));
</script>

<QuestionScreen heading="What's your game called?" counter={{ n: 1, of: 7 }} back="/make">
  <TextAnswer
    name="name"
    previews="name"
    value={form?.value ?? ""}
    hint="The name players see. Like: Floor Fifty."
    problem={form?.problem}
  />
</QuestionScreen>
