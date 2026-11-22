<!-- Changing a link, question one of two: what it says, and what kind it is. -->
<script lang="ts">
  import { LINK_KIND_CHOICES } from "../../../../../features/pages/pages.ts";
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
    legend="What kind is it?"
    plain
    options={LINK_KIND_CHOICES.map(({ value, title }) => ({ value, title }))}
    chosen={[form?.kind ?? data.kind]}
    problem={undefined}
  />
</QuestionScreen>
