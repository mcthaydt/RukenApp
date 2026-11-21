<!--
  One room of your page: one question on the felt, as a game's answer is changed. Which room is the address's last word.
-->
<script lang="ts">
  import ColourQuestion from "../../parts/ColourQuestion.svelte";
  import PhotoQuestion from "../../parts/PhotoQuestion.svelte";
  import QuestionScreen from "../../parts/QuestionScreen.svelte";
  import TextAnswer from "../../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const problem = $derived(form?.problem);
</script>

{#key data.room}
  {#if data.room === "address"}
    <QuestionScreen
      heading="Pick your page's address"
      title="Your page · Ruken"
      counter={null}
      back="/make/page"
    >
      <TextAnswer
        name="handle"
        value={form?.value ?? data.address}
        hint={`People find your page at ${data.host}/yourname. Use letters, numbers and hyphens.`}
        {problem}
      />
    </QuestionScreen>
  {:else if data.room === "name"}
    <QuestionScreen
      heading="What should your page call you?"
      title="Your page · Ruken"
      counter={null}
      back="/make/page"
    >
      <TextAnswer
        name="name"
        value={form?.value ?? data.name}
        hint="It is the big name at the top of your page."
        {problem}
      />
    </QuestionScreen>
  {:else if data.room === "about"}
    <QuestionScreen
      heading="Say one line about you"
      title="Your page · Ruken"
      counter={null}
      back="/make/page"
    >
      <TextAnswer
        name="oneLine"
        grows
        value={form?.value ?? data.oneLine}
        hint="It sits under your name on your page. Like: I make small, hard games."
        {problem}
      />
    </QuestionScreen>
  {:else if data.room === "photo"}
    <PhotoQuestion photo={data.photo} {problem} />
  {:else}
    <ColourQuestion themeId={data.themeId} {problem} />
  {/if}
{/key}
