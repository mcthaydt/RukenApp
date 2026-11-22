<!-- Changing a link, question two of two: where it goes. Saving changes the link where it sits. -->
<script lang="ts">
  import QuestionScreen from "../../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const title = $derived(form?.title ?? data.title);
  const kind = $derived(form?.kind ?? data.kind);
</script>

<QuestionScreen
  heading="Where does it go?"
  counter={null}
  back={`/make/page/links/${data.id}`}
  action={`?/save&title=${encodeURIComponent(title)}${kind === "link" ? "" : `&kind=${kind}`}`}
>
  <TextAnswer
    name="url"
    value={form?.url ?? data.url}
    hint="A link starts with https://"
    problem={form?.problem}
  />
</QuestionScreen>
