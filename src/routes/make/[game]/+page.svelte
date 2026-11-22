<!--
  A game that is past its questions: where it stands, in the maker's words, and the one next step. Waiting, Sent back and
  Live and Taken off each have their own screen; a game staff took down has only its headline and the way back.
-->
<script lang="ts">
  import AcceptedScreen from "../parts/AcceptedScreen.svelte";
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
    line={data.line}
    changeAddress={data.changeAddress}
    filesProblem={data.filesProblem}
    filesAddress={data.filesAddress}
    throwAway={data.throwAway}
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
{:else if data.view === "accepted"}
  <AcceptedScreen name={data.name} count={data.count} backdrop={data.backdrop} />
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
    showsPlayerCount={data.showsPlayerCount}
    wished={data.wished}
    problem={form?.problem}
  />
{:else if data.view === "taken_off"}
  <TakenOffScreen
    name={data.name}
    nextStep={data.nextStep}
    filesLeft={data.filesLeft}
    connectAddress={data.connectAddress}
    game={data.game}
    throwAway={data.throwAway}
    problem={form?.problem}
  />
{:else}
  <StateScreen name={data.name} headline={data.headline} nextStep={data.nextStep} />
{/if}
