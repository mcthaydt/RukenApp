<!--
  How the feed picks games, in plain words, for anyone. It keeps what works today apart from what is coming, so it never
  promises ahead of the code: "today" is the open ranker, `src/features/feed/public-ranker.ts`, and
  `memberBeatsByGame` in `src/features/play/sessions.ts`; "coming" is the learned feed (spec 2026-11-22-learned-feed-design.md) in the words the
  Owner approved for this page on 2026-11-15. It names rules, never a number the order is tuned with, so the feed can't be
  gamed from it. When the feed changes, this page changes in the same pull request. The real order is
  private (spec 2026-11-22-private-feed-ranking-design.md, section 3): a private ranking change that would make this page
  untrue merges only after a pull request here that changes the page has merged. One paper sheet on the felt like the
  other help pages, with the way back at the top and again at the foot.
-->
<script lang="ts">
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<main class="card">
  <p><a class="quiet" href={data.back.href}>{data.back.words}</a></p>
  <h1>How the feed works</h1>
  <p class="note">Last updated 22 November 2026</p>
  <p>
    This is how Ruken picks the games you see. Some of it works today, and the rest is coming soon. We say
    which is which.
  </p>

  <section aria-labelledby="today">
    <h2 id="today">How it works today</h2>
    <ul class="bullets">
      <li>Everyone sees the same feed. It doesn't learn anything about you yet.</li>
      <li>New games go near the top for their first week, so every new game gets seen.</li>
      <li>
        After that, a game moves up when members play it. The more they have played it lately, the higher it
        goes.
      </li>
      <li>
        Only real play counts: the game is on your screen and you're using it. A game left in a hidden tab
        adds nothing.
      </li>
      <li>A maker playing their own game adds nothing. Neither does Ruken's staff playing it.</li>
      <li>Games that are level swap places from day to day.</li>
      <li>The feed never ends. When you have seen every game, it goes round again.</li>
      <li>Games made for adults aren't in the feed.</li>
    </ul>
  </section>

  <section aria-labelledby="coming">
    <h2 id="coming">Coming soon</h2>
    <p>We're building a feed that learns what you like. Here's how it will work.</p>
    <ul class="bullets">
      <li>
        <strong>Good games rise because people play them.</strong> A game moves up when members play it and come
        back to it. Watching and liking help a little. Playing counts most.
      </li>
      <li>
        <strong>Every new game gets a fair start.</strong> When a game is new, we show its clip to a set of players
        first. After that, it rises or falls on how much people play it.
      </li>
      <li>
        <strong>Your feed is yours.</strong> It learns from what you play and watch. Now and then it shows you something
        different, so you can find games you didn't know you'd like.
      </li>
      <li>
        <strong>You're in charge of it.</strong> Tap More like this or Less like this on any clip. Open Your feed
        to see what it thinks you like, and change it. Tap Start over to wipe what it has learned.
      </li>
      <li>
        <strong>Nothing before you say yes.</strong> It won't learn anything about you until you press "I agree"
        on the cookie notice.
      </li>
      <li>
        <strong>If you're under 18.</strong> Your feed doesn't learn from what you do until a parent says yes. We
        text your parent, and they tap Yes or No.
      </li>
      <li>
        <strong>For makers.</strong> You can add more than one clip for a game. We show the one that gets the most
        people playing. If people watch your clip but don't tap Play, we'll tell you.
      </li>
      <li>
        <strong>What we keep to ourselves.</strong> We'll add a few touches of our own to keep the feed fresh and
        to help great games get noticed. We keep those, and the exact numbers, to ourselves so the feed can't be
        cheated.
      </li>
    </ul>
  </section>

  <section aria-labelledby="never">
    <h2 id="never">What we never do</h2>
    <ul class="bullets">
      <li>Nobody can pay to move a game up the feed. Paying more adds nothing.</li>
      <li>Ruken has no ads.</li>
      <li>We don't sell your data.</li>
      <li>Every number we show, like plays and likes, comes from real people.</li>
    </ul>
  </section>

  <p><a class="go" href="/privacy">Read what we keep about you</a></p>
  <p><a class="go" href="/terms">Read the terms</a></p>
  <p><a class="quiet" href={data.back.href}>{data.back.words}</a></p>
</main>
