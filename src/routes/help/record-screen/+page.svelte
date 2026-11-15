<!--
  Recording the screen, in plain steps for someone who has never done it: a phone or tablet, then a computer. It is one
  paper sheet on the felt like the GitHub how-to, with the way back at the top and again at the foot. Nothing on it is a
  button. A Mac saves its recording as a .mov, which Ruken takes (Owner, 2026-11-15: "Yes, take .mov"), so a Mac maker
  records and sends it like anyone else.
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

  <!-- The steps for four devices are a long page on a phone: a maker goes straight to their own. -->
  <nav aria-label="Pick your device">
    <ul>
      <li><a href="#iphone">iPhone or iPad</a></li>
      <li><a href="#android">Android phone</a></li>
      <li><a href="#windows">Windows computer</a></li>
      <li><a href="#mac">Mac</a></li>
    </ul>
  </nav>

  <h2>On a phone or tablet</h2>
  <h3 id="iphone">iPhone or iPad</h3>
  <ol>
    <li>Open Settings, then Control Center. Add Screen Recording.</li>
    <li>
      Swipe down from the top right corner of the screen. On a phone with a Home button, swipe up from the
      bottom instead.
    </li>
    <li>Press the round record button. Wait for the count of three.</li>
    <li>Open your game and play it.</li>
    <li>Swipe down again and press the record button to stop. Your video is in Photos.</li>
  </ol>
  <h3 id="android">Android phone</h3>
  <ol>
    <li>Swipe down from the top of the screen. Swipe down again if you need to.</li>
    <li>Choose Screen record. Some phones call it Screen recorder.</li>
    <li>Press Start.</li>
    <li>Open your game and play it.</li>
    <li>Swipe down and press Stop. Your video is in Photos or Gallery.</li>
  </ol>

  <h2>On a computer</h2>
  <h3 id="windows">Windows computer</h3>
  <ol>
    <li>Open your game in your browser.</li>
    <li>Press the Windows key and the letter G together. The Game Bar opens.</li>
    <li>Choose Capture, then the round record button.</li>
    <li>Play your game, then choose the stop button. Your video is in your Videos folder, in Captures.</li>
  </ol>
  <h3 id="mac">Mac</h3>
  <ol>
    <li>Open your game in your browser.</li>
    <li>Press Shift, Command and 5 together.</li>
    <li>Choose Record Entire Screen, then Record.</li>
    <li>Play your game, then press the stop button at the top of the screen.</li>
    <li>Your video is on your Desktop. Ruken takes this kind of file.</li>
  </ol>

  <p>Then come back to Ruken and press Choose video.</p>
  <p><a href={data.back.href}>{data.back.words}</a></p>
</main>
