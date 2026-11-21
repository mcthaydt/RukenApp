<!--
  Your page. With no page yet, the one question that makes it: its address. With a page, the rooms: one paper row each,
  a link to its question, with what is saved in it, then where to see the page and how often it was opened.
-->
<script lang="ts">
  import QuestionScreen from "../parts/QuestionScreen.svelte";
  import TextAnswer from "../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();

  const problem = $derived(form?.problem);
  let saving = $state(false);
</script>

<svelte:head>
  <title>Your page · Ruken</title>
</svelte:head>

{#if data.page === null}
  <QuestionScreen
    heading="Pick your page's address"
    title="Your page · Ruken"
    counter={null}
    back="/make"
    bind:saving
  >
    <TextAnswer
      name="handle"
      value={form?.value ?? ""}
      hint={`People find your page at ${data.host}/yourname. Use letters, numbers and hyphens.`}
      {problem}
    />
  </QuestionScreen>
{:else}
  <main class="games">
    <h1>Your page</h1>
    {#if data.saved !== null}
      <p role="status">{data.saved}</p>
    {/if}
    <a class="game" href="/make/page/address">
      <span><span class="statement">Address</span><span>{data.host}/{data.page.handle}</span></span>
    </a>
    <a class="game" href="/make/page/name">
      <span><span class="statement">Name</span><span>{data.page.name}</span></span>
    </a>
    <a class="game" href="/make/page/about">
      <span>
        <span class="statement">About you</span>
        <span>{data.page.oneLine === "" ? "Nothing yet" : data.page.oneLine}</span>
      </span>
    </a>
    <a class="game" href="/make/page/photo">
      <span>
        <span class="statement">Photo</span>
        <span>{data.page.hasPhoto ? "Added" : "None yet"}</span>
      </span>
    </a>
    <a class="game" href="/make/page/colours">
      <span>
        <span class="statement">Colours</span>
        <span>{data.page.themeId === 0 ? "Ruken's own colours" : `Colours ${String(data.page.themeId)}`}</span
        >
      </span>
    </a>
    <a class="game" href="/make/page/links">
      <span><span class="statement">Links</span><span>{data.page.links}</span></span>
    </a>
    <div class="acts">
      <a class="button" href={`/${data.page.handle}`}>See your page</a>
      <a class="button safe" href="/make">Back to your games</a>
    </div>
    <p class="note">Opened {data.page.opened}.</p>
  </main>
{/if}
