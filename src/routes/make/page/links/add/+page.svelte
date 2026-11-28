<!-- A new link, question one of two: what it should say, and whether it is a game somewhere else or a small icon. -->
<script lang="ts">
  import Picks from "../../../parts/Picks.svelte";
  import QuestionScreen from "../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../parts/TextAnswer.svelte";
  import { KIND_CHOICES } from "../link-kind.ts";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<QuestionScreen heading="What should the link say?" counter={null} back="/make/page/links" action="?/words">
  <TextAnswer name="title" value={form?.title ?? ""} hint="Like: My Discord." problem={form?.problem} />
  <Picks
    name="kind"
    several
    alone
    legend="What kind of link?"
    plain
    options={KIND_CHOICES}
    chosen={form?.kind === undefined || form.kind === "link" ? [] : [form.kind]}
    problem={undefined}
  />
</QuestionScreen>
