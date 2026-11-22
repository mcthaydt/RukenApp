<!-- A new link, question one of two: what it should say, and whether it is a game somewhere else. -->
<script lang="ts">
  import Picks from "../../../parts/Picks.svelte";
  import QuestionScreen from "../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<QuestionScreen
  title="Add a link · Ruken"
  heading="What should the link say?"
  counter={null}
  back="/make/page/links"
  action="?/words"
  busyWords="Saving…"
>
  <TextAnswer name="title" value={form?.title ?? ""} hint="Like: My Discord." problem={form?.problem} />
  <Picks
    name="kind"
    several
    legend="Is it a game?"
    plain
    options={[{ value: "game_elsewhere", title: "A game somewhere else" }]}
    chosen={form?.game === true ? ["game_elsewhere"] : []}
    problem={undefined}
  />
</QuestionScreen>
