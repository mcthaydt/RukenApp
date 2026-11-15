<!--
  Putting a game on GitHub, in plain steps for someone who has never used it, and what Ruken needs of the folder. It is
  one paper sheet on the felt, with the way back at the top so it is never a long scroll away on a phone, and again at the
  foot, where a person who has read to the end looks for it. Nothing on it is a button.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Put your game on GitHub · Ruken</title>
</svelte:head>

<main class="card">
  <p><a href={data.back.href}>{data.back.words}</a></p>
  <h1>Put your game on GitHub</h1>
  <p>GitHub is a free website that keeps your game's files. Ruken copies your game from there.</p>
  <ol>
    <li>Make a free account at github.com.</li>
    <li>
      Make a new repository. That's GitHub's word for a place that keeps one game. Give it your game's name.
    </li>
    <li>
      Upload your game's files: everything in the folder that has index.html in it. GitHub takes up to 100
      files at a time. If you have more, upload them in a few goes.
    </li>
    <li>Save it. GitHub calls this "Commit changes".</li>
    <li>Come back to Ruken and choose Connect GitHub.</li>
  </ol>
  <h2 id="folder">Set up your game's folder</h2>
  <p>Ruken starts your game from a file called index.html.</p>
  <p>Open index.html on your own computer first. If your game runs in your browser, it's ready.</p>
  <p>
    If your game was made with a game-making tool, export it for the web first. The tool may call this "Web"
    or "HTML5".
  </p>
  <p>
    If index.html sits inside another folder, tell Ruken which one. Choose "Change the branch or folder" and
    write the folder's name, like web/build.
  </p>
  <p><a href={data.back.href}>{data.back.words}</a></p>
</main>
