<!-- A new link, question one of two: what it should say, and what kind it is. -->
<script lang="ts">
  import Picks from "../../../parts/Picks.svelte";
  import QuestionScreen from "../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<QuestionScreen
  heading="What should the link say?"
  counter={null}
  back="/make/page/links"
  action="?/words"
  busyWords="Saving…"
>
  <TextAnswer name="title" value={form?.title ?? ""} hint="Like: My Discord." problem={form?.problem} />
  <Picks
    name="kind"
    legend="What kind is it?"
    plain
    options={data.choices}
    chosen={[form?.kind ?? "link"]}
    problem={undefined}
  />
</QuestionScreen>
