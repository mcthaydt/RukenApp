<!-- Changing a link, question one of two: what it says, and whether it is a game somewhere else or a small icon. -->
<script lang="ts">
  import Picks from "../../../parts/Picks.svelte";
  import QuestionScreen from "../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../parts/TextAnswer.svelte";
  import { KIND_CHOICES } from "../link-kind.ts";
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
    alone
    plain
    legend="What kind of link?"
    options={KIND_CHOICES}
    chosen={(form?.kind ?? data.kind) === "link" ? [] : [form?.kind ?? data.kind]}
    problem={undefined}
  />
</QuestionScreen>
