<!--
  A game that is past its questions: where it stands, in the maker's words, and the one next step. Waiting, Sent back and
  Live each have their own screen, and so does a game its maker took off Ruken; a game taken down has only its headline and
  the way back.
-->
<script lang="ts">
  import LiveScreen from "../parts/LiveScreen.svelte";
  import SentBackScreen from "../parts/SentBackScreen.svelte";
  import StateScreen from "../parts/StateScreen.svelte";
  import TakenOffScreen from "../parts/TakenOffScreen.svelte";
  import WaitingScreen from "../parts/WaitingScreen.svelte";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

{#if data.view === "waiting"}
  <WaitingScreen
    game={data.game}
    changeAddress={data.changeAddress}
    filesProblem={data.filesProblem}
    filesAddress={data.filesAddress}
  />
{:else if data.view === "sent_back"}
  <SentBackScreen
    name={data.name}
    line={data.line}
    fixes={data.fixes}
    accepted={data.accepted}
    game={data.game}
    throwAway={data.throwAway}
    problem={form?.problem}
  />
{:else if data.view === "live"}
  <LiveScreen
    line={data.line}
    send={data.send}
    updateWaiting={data.updateWaiting}
    fixes={data.fixes}
    takeOffAddress={data.takeOffAddress}
    pageAddress={data.pageAddress}
    backdrop={data.backdrop}
    game={data.game}
    problem={form?.problem}
  />
{:else if data.view === "taken_off"}
  <TakenOffScreen name={data.name} line={data.line} filesLeft={data.filesLeft} problem={form?.problem} />
{:else}
  <StateScreen name={data.name} headline={data.headline} nextStep={data.nextStep} />
{/if}
