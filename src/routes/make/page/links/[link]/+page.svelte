<!-- Changing a link, question one of two: what it says, and whether it is a game somewhere else. -->
<script lang="ts">
  import Picks from "../../../parts/Picks.svelte";
  import QuestionScreen from "../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<QuestionScreen heading="What should the link say?" counter={null} back="/make/page/links" action="?/words">
  <TextAnswer
    name="title"
    value={form?.title ?? data.title}
    hint="Like: My Discord."
    problem={form?.problem}
  />
  <Picks
    name="kind"
    several
    plain
    legend="Is it a game?"
    options={[{ value: "game_elsewhere", title: "A game somewhere else" }]}
    chosen={(form?.game ?? data.game) ? ["game_elsewhere"] : []}
    problem={undefined}
  />
</QuestionScreen>
