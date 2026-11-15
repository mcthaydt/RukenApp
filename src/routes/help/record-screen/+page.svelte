<!--
  Recording the screen, in plain steps for someone who has never done it: a phone or tablet, then a computer. It is one
  paper sheet on the felt like the GitHub how-to, with the way back at the top and again at the foot. Nothing on it is a
  button. A Mac saves a kind of video Ruken does not take (MP4 or WebM only), and the page says so rather than leaving
  her to find out when her video is refused.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Record your screen · Ruken</title>
</svelte:head>

<main class="card">
  <p><a href={data.back.href}>{data.back.words}</a></p>
  <h1>Record your screen</h1>
  <p>
    Play your game while your phone or computer records. Keep it to 10 to 30 seconds. Ruken takes videos up to
    30 MB, so a short one is best.
  </p>

  <h2>On a phone or tablet</h2>
  <h3>iPhone or iPad</h3>
  <ol>
    <li>Open Settings, then Control Centre. Add Screen Recording.</li>
    <li>
      Swipe down from the top right corner of the screen. On a phone with a Home button, swipe up from the
      bottom instead.
    </li>
    <li>Press the round record button. Wait for the count of three.</li>
    <li>Open your game and play it.</li>
    <li>Swipe down again and press the record button to stop. Your video is in Photos.</li>
  </ol>
  <h3>Android phone</h3>
  <ol>
    <li>Swipe down from the top of the screen. Swipe down again if you need to.</li>
    <li>Choose Screen record. Some phones call it Screen recorder.</li>
    <li>Press Start.</li>
    <li>Open your game and play it.</li>
    <li>Swipe down and press Stop. Your video is in Photos or Gallery.</li>
  </ol>

  <h2>On a computer</h2>
  <h3>Windows computer</h3>
  <ol>
    <li>Open your game in your browser.</li>
    <li>Press the Windows key and the letter G together. The Game Bar opens.</li>
    <li>Choose Capture, then the round record button.</li>
    <li>Play your game, then choose the stop button. Your video is in your Videos folder, in Captures.</li>
  </ol>
  <h3>Mac</h3>
  <p>Macs save a .mov file, which Ruken can't take yet. The easy way is to record on your phone instead.</p>

  <p>Then come back to Ruken and choose Choose video.</p>
  <p><a href={data.back.href}>{data.back.words}</a></p>
</main>
