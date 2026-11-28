<!-- A new link, question two of two: where it goes. Saving makes the link and shows the list. -->
<script lang="ts">
  import QuestionScreen from "../../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const title = $derived(form?.title ?? data.title);
  const kind = $derived(form?.kind ?? data.kind);
  // The words ride in the address as well as in the form, so a refusal shown without script is still this question.
</script>

<QuestionScreen
  heading="Where does it go?"
  counter={null}
  back="/make/page/links/add"
  action={`?/add&title=${encodeURIComponent(title)}${kind === "link" ? "" : `&kind=${kind}`}`}
>
  <input type="hidden" name="title" value={title} />
  <input type="hidden" name="kind" value={kind} />
  <TextAnswer name="url" value={form?.url ?? ""} hint="A link starts with https://" problem={form?.problem} />
</QuestionScreen>
