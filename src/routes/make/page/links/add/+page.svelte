<!--
  Adding a link, in two questions: "What should the link say?" with a choice for a game somewhere else, then "Where does it
  go?". The second question carries the first one's answer along in hidden fields.
-->
<script lang="ts">
  import Picks from "../../../parts/Picks.svelte";
  import QuestionScreen from "../../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const problem = $derived(form?.problem);
  // A refusal brings back what the first question was answered, since a form sent without script has no address to carry it.
  const elsewhere = $derived(form?.elsewhere ?? data.elsewhere);
  const title = $derived(form?.title ?? data.title);
  const step = $derived(form?.step ?? data.step);
</script>

{#key step}
  {#if step === "words"}
    <QuestionScreen
      heading="What should the link say?"
      primary="Next"
      title="Your links · Ruken"
      counter={null}
      back="/make/page/links"
    >
      <TextAnswer
        name="title"
        value={form?.step === "words" ? form.value : title}
        hint="Players see these words. Like: My Discord."
        {problem}
      />
      <Picks
        name="elsewhere"
        options={[
          {
            value: "1",
            title: "A game somewhere else",
            line: "A game of yours on another site, like Steam.",
          },
        ]}
        chosen={elsewhere ? ["1"] : []}
        several
        problem={undefined}
      />
    </QuestionScreen>
  {:else}
    <QuestionScreen
      heading="Where does it go?"
      title="Your links · Ruken"
      counter={null}
      back="/make/page/links/add"
    >
      <input type="hidden" name="title" value={title} />
      {#if elsewhere}
        <input type="hidden" name="elsewhere" value="1" />
      {/if}
      <TextAnswer name="url" value={form?.value ?? ""} hint="A link starts with https://" {problem} />
    </QuestionScreen>
  {/if}
{/key}
