<!--
  Your page (spec 5.5): the rooms. Each is a paper row that says what is saved and is a link to its question. A maker
  with no page yet is asked the first question, the address, and saving it makes the page.
-->
<script lang="ts">
  import QuestionScreen from "../parts/QuestionScreen.svelte";
  import TextAnswer from "../parts/TextAnswer.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

{#if data.rooms === null}
  {#if data.saved !== null}
    <p class="note" role="status">{data.saved}</p>
  {/if}
  <QuestionScreen heading="Pick your page's address" counter={null} back="/make" action="?/make">
    <TextAnswer
      name="handle"
      value={form?.handle ?? ""}
      hint={`People find your page at ${data.host}/yourname. Use letters, numbers and hyphens.`}
      problem={form?.problem}
    />
  </QuestionScreen>
{:else}
  {@const rooms = data.rooms}
  <main class="games">
    <h1>Your page</h1>
    {#if data.saved !== null}
      <p role="status">{data.saved}</p>
    {/if}
    <a class="game" href="/make/page/address"
      ><span><span class="statement">Address</span><span>{rooms.address}</span></span></a
    >
    <a class="game" href="/make/page/name"
      ><span><span class="statement">Name</span><span>{rooms.name}</span></span></a
    >
    <a class="game" href="/make/page/line"
      ><span
        ><span class="statement">About you</span><span
          >{rooms.oneLine === "" ? "Not yet" : rooms.oneLine}</span
        ></span
      ></a
    >
    <a class="game" href="/make/page/photo"
      ><span><span class="statement">Photo</span><span>{rooms.photo}</span></span></a
    >
    <a class="game" href="/make/page/colours"
      ><span><span class="statement">Colours</span><span>{rooms.colours}</span></span></a
    >
    <a class="game" href="/make/page/links"
      ><span><span class="statement">Links</span><span>{rooms.links}</span></span></a
    >
    <p class="note ways"><a class="quiet" href={`/${rooms.handle}`}>See your page</a> {rooms.opened}</p>
    <div class="acts">
      <a class="button safe" href="/make">Back to your games</a>
    </div>
    <p class="note"><a class="quiet" href="/make/page/take-down">Take my page down</a></p>
  </main>
{/if}
