<!-- A new link, question two of two: where it goes. Saving makes the link and shows the list. -->
<script lang="ts">
  import QuestionScreen from "../../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const title = $derived(form?.title ?? data.title);
  const game = $derived(form?.game ?? data.game);
  // The words ride in the address as well as in the form, so a refusal shown without script is still this question.
</script>

<QuestionScreen
  title="Add a link · Ruken"
  heading="Where does it go?"
  counter={null}
  back="/make/page/links/add"
  action={`?/add&title=${encodeURIComponent(title)}${game ? "&game=1" : ""}`}
>
  <input type="hidden" name="title" value={title} />
  <input type="hidden" name="game" value={game ? "1" : "0"} />
  <TextAnswer name="url" value={form?.url ?? ""} hint="A link starts with https://" problem={form?.problem} />
</QuestionScreen>
