<!--
  Question 1 of a game that does not exist yet: its name. Next makes the game and goes on to its one line. Back is Your
  games. Nothing is saved before the name is given, so there is nothing to throw away yet.
-->
<script lang="ts">
  import QuestionScreen from "../parts/QuestionScreen.svelte";
  import TextAnswer from "../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<QuestionScreen heading="What's your game called?" counter={{ n: 1, of: 7 }} back="/make">
  <TextAnswer
    name="name"
    value={form?.value ?? ""}
    hint="The name players see. Like: Floor Fifty."
    problem={form?.problem}
  />
</QuestionScreen>
