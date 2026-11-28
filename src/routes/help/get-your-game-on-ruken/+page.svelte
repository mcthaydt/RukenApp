<!--
  The step-by-step guide to getting a game on Ruken, for a maker who has never done it. It is one paper sheet on the
  felt like the other how-tos, with the way back at the top and again at the foot. Its one button copies the prompt for
  a maker's AI coding helper; everything else is reading and links. The steps use the words the screens use, so a maker
  finds on the screen what they read here.
-->
<script lang="ts">
  import { onMount } from "svelte";
  import { AGENT_PROMPT, PROMPT_CLOSING, PROMPT_OPENING, PROMPT_STEPS } from "./agent-prompt.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const here = "/help/get-your-game-on-ruken";
  const githubHowTo = `/help/github?from=${encodeURIComponent(here)}`;
  const recordHowTo = `/help/record-screen?from=${encodeURIComponent(here)}`;

  // False until the page's script has run. Without script there is no Copy button, and the prompt is still there to
  // select and copy by hand.
  let woke = $state(false);
  let copied = $state<"no" | "yes" | "failed">("no");

  onMount(() => {
    woke = true;
  });

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(AGENT_PROMPT);
      copied = "yes";
    } catch {
      // A browser can refuse the clipboard (an old one, or a page in a frame): the words say what still works.
      copied = "failed";
    }
  }
</script>

<main class="card">
  <p><a class="quiet" href={data.back.href}>{data.back.words}</a></p>
  <h1>Get your game on Ruken</h1>
  <p>Ruken is where people find web games and play them. Here's how to put yours there.</p>

  <!-- A long page on a phone: a maker goes straight to the part they need. -->
  <nav aria-label="On this page">
    <ul class="sidelinks">
      <li><a class="go" href="#helper">Let an AI helper do it</a></li>
      <li><a class="go" href="#need">What you need</a></li>
      <li><a class="go" href="#steps">Step by step</a></li>
      <li><a class="go" href="#fixes">If Ruken can't start your game</a></li>
    </ul>
  </nav>

  <h2 id="helper">Let an AI helper do it</h2>
  <p>
    Use an AI coding helper, like Claude Code? Copy this and paste it in. It gets your game ready and puts it
    on GitHub. Then it tells you what's left to do on Ruken.
  </p>
  {#if woke}
    <p><button type="button" onclick={copyPrompt}>Copy the prompt</button></p>
  {/if}
  <p class="note" role="status">
    {#if copied === "yes"}
      Copied. Paste it into your AI helper.
    {:else if copied === "failed"}
      We couldn't copy it. Open Read the prompt, then select the words and copy them yourself.
    {/if}
  </p>

  <!-- The prompt is long on a phone, so it is folded away and the guide's steps stay close. The button copies it either
       way; open, it can be read and copied by hand. -->
  <details>
    <summary>Read the prompt</summary>
    <div role="region" aria-label="The prompt for your AI helper">
      {#each PROMPT_OPENING as words (words)}
        <p>{words}</p>
      {/each}
      <ol>
        {#each PROMPT_STEPS as step (step.words)}
          <li>
            {step.words}
            {#if step.points !== undefined}
              <ul>
                {#each step.points as point (point)}
                  <li>{point}</li>
                {/each}
              </ul>
            {/if}
          </li>
        {/each}
      </ol>
      <p>{PROMPT_CLOSING}</p>
    </div>
  </details>

  <h2 id="need">What you need</h2>
  <ul>
    <li>Your game, running in a web browser. It starts from a file called index.html.</li>
    <li>Your game on GitHub. <a href={githubHowTo}>Here's how to put it there</a></li>
    <li>
      Two short videos of your game being played: one taller than wide, for phones, and one wider than tall,
      for computers. Keep each to 10 to 30 seconds. <a href={recordHowTo}>Here's how to record your screen</a>
    </li>
  </ul>

  <h2 id="steps">Step by step</h2>

  <h3>1. Join Ruken</h3>
  <p>
    <a href="/sign-up?next=%2Fmake">Join Ruken</a> with your phone number. We text you a code to check it's
    you. Already joined? <a href="/sign-in?next=%2Fmake">Sign in</a>.
  </p>

  <h3>2. Add your game</h3>
  <p>
    Go to <a href="/make">Your games</a> and press Add a game. Ruken asks you six short questions, one at a time.
  </p>
  <ol>
    <li>Your game's name. This is the name players see.</li>
    <li>What it's about, in one line. Players see it under the name.</li>
    <li>
      Where your game's files are. Press Connect GitHub. GitHub asks which games Ruken can see: pick yours.
      Back on Ruken, pick your game from the list.
    </li>
    <li>Your upright video, for phones.</li>
    <li>Your wide video, for computers.</li>
    <li>
      Who it's for: 3+, 7+, 12+, 16+ or 18+. An 18+ game gets one more question, about sex or nudity, gore and
      drugs. No game may have pornography, gambling or ads.
    </li>
  </ol>
  <p>
    Is index.html inside a folder? Choose "Change the branch or folder" and type the folder's name, like
    web/build.
  </p>
  <p>
    Is your game kept by a team on GitHub (GitHub calls it an organization)? On GitHub's page, pick the team
    instead of yourself. If you can't, ask the team's owner to let Ruken in.
  </p>

  <h3>3. Check it, then send</h3>
  <p>
    Ruken shows your game the way players will see it. The first time, you read the maker agreement and press
    I agree.
  </p>
  <p>
    Does your game use other websites while it plays, like a high-score server? Choose "Change the other
    websites" and add them. Five at most.
  </p>
  <p>Your game must work on phones and computers. When it does, press Send for review.</p>

  <h3>4. Wait for a person to look</h3>
  <p>
    A person checks every game. Your game's page in Your games says when you'll hear. If we send it back, it
    says what to fix. Fix it and send it again.
  </p>

  <h3>5. Players find it</h3>
  <p>
    Once it's live, players find it in the feed on Ruken's front page. It has its own link too, like
    ruken.io/g/your-game. Press See it on Ruken to get it.
  </p>
  {#if data.pageEditor}
    <p>
      Make <a href="/make/page">your page</a> too. It shows all your games in one place, at ruken.io/your-name.
    </p>
  {/if}

  <h2>Change it later</h2>
  <p>
    Open your game in Your games to change anything. A person checks the change, and players keep playing the
    old version while you wait. You can take your game off Ruken at any time.
  </p>

  <h2 id="fixes">If Ruken can't start your game</h2>
  <p>Ruken tells you what's wrong. These are the usual fixes:</p>
  <ul>
    <li>
      No index.html: put index.html at the top of your game's folder, or tell Ruken which folder it's in.
    </li>
    <li>An address with a slash at the start, like /game.js: take the slash off, so it reads game.js.</li>
    <li>Too big: Ruken takes up to 1,500 files, 50 MB for one file, and 400 MB in all.</li>
    <li>A file stored with Git LFS, or a link to another file: upload the file itself to GitHub instead.</li>
  </ul>

  <p><a class="quiet" href={data.back.href}>{data.back.words}</a></p>
</main>
