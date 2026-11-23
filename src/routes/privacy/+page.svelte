<!--
  Privacy: what Ruken keeps, why, who helps, and for how long, in plain words. It says only what the code does today;
  anything not decided yet says so instead of guessing. A lawyer has not read it, and the top of the page says that.
  When Ruken starts keeping something new, setting a new cookie or using a new outside service, this page changes in
  the same pull request (this-repo, "The privacy and terms pages keep up"; tests/routes/privacy/cookies.test.ts).
-->
<svelte:head>
  <title>Privacy · Ruken</title>
</svelte:head>

<main class="card">
  <p><a class="quiet" href="/">Back to Ruken</a></p>
  <h1>Privacy</h1>
  <p class="note">Last updated 22 November 2026</p>
  <p>
    <strong>This is a draft.</strong> A lawyer has not checked it yet. It says what Ruken does today, and it will
    change before Ruken opens.
  </p>

  <h2>The short version</h2>
  <ul class="bullets">
    <li>You can watch the feed without an account.</li>
    <li>To make an account, we need your phone number, a password and your date of birth.</li>
    <li>We don't keep your birthday. We keep only the day you turn 18.</li>
    <li>Stripe takes your card. We never see your card number.</li>
    <li>We count how long members play each game, so we can pay the people who made it.</li>
    <li>Ruken has no ads, and no game on Ruken may have ads. We don't sell what we know about you.</li>
    <li>You can delete your account at any time. 14 days later, your details are gone.</li>
  </ul>

  <h2>Your account</h2>
  <ul class="bullets">
    <li>
      <strong>Your phone number.</strong> It's how you sign in. We text you codes and notes about your account.
    </li>
    <li><strong>Your password.</strong> We keep it scrambled, so nobody at Ruken can read it.</li>
    <li>
      <strong>Your age.</strong> We ask for your date of birth to check you're 13 or older. We keep only the day
      you turn 18, so we know if you're under 18. If you're under 13, we keep nothing you typed.
    </li>
    <li>
      <strong>While you sign up.</strong> Until you type the code we texted, we keep your number, your scrambled
      password and the day you turn 18, for up to 10 minutes.
    </li>
    <li>
      <strong>Your email, if you pay.</strong> Stripe gives us the email you paid with. We use it to send a code
      if we can't tell your phone number is still yours, and for emails the law needs us to send.
    </li>
    <li>
      <strong>Where you're signed in.</strong> For each phone or computer you sign in on, we keep its internet address
      and the name of its browser. A sign-in lasts 30 days after you last used Ruken, or until you sign out.
    </li>
    <li>
      <strong>Your computers.</strong> If you let a computer use your Ruken (<code>npx ruken sign-in</code>),
      we keep its name, a scrambled copy of its key, and when it was let in and last used. A key stops working
      after 90 days unused, or when you remove it. Changing or resetting your password removes every computer.
    </li>
    <li>
      <strong>While a computer asks to sign in.</strong> We keep the city and country it asked from, to show you
      before you say Yes. The code works for 10 minutes, and old codes are cleared out as new ones come in.
    </li>
  </ul>

  <h2>Keeping your account safe</h2>
  <ul class="bullets">
    <li>
      We count tries from each internet address for a short time, to slow down people who guess passwords.
    </li>
    <li>
      If someone types the wrong password for a number too many times, we pause sign-in for that number for an
      hour. We keep the number scrambled for this.
    </li>
    <li>
      When you reset your password, we ask Twilio, the company that sends our texts, if your number has
      changed owners since you last proved it was yours.
    </li>
  </ul>

  <h2>Texts</h2>
  <ul class="bullets">
    <li>Twilio sends our texts. We only text codes and notes about your account.</li>
    <li>Reply STOP to stop texts, or HELP for help. Message and data rates may apply.</li>
    <li>We keep a note that a text went out and when. That note doesn't hold your number.</li>
    <li>Sign-up is open to phone numbers in the United States and Canada.</li>
  </ul>

  <h2>Your membership</h2>
  <ul class="bullets">
    <li>Stripe takes your payment. Your card goes to Stripe, not to us. Stripe emails your receipts.</li>
    <li>We keep your plan, whether it's running, and when it renews or ends.</li>
    <li>For each payment, we keep what you paid, the tax, and Stripe's fee. We need this to pay makers.</li>
  </ul>

  <h2>Which maker brought you</h2>
  <ul class="bullets">
    <li>
      When you open a maker's page or any game's page, also from the feed, we put a small file (a cookie) in
      your browser. It remembers the last maker whose page or game you opened, and when.
    </li>
    <li>If you then become a member, we write down that maker, so they get a bonus for bringing you.</li>
    <li>
      It lasts 400 days from the last time, and the next maker's page or game you open replaces it. You can
      clear it in your browser.
    </li>
  </ul>

  <h2>What you play</h2>
  <ul class="bullets">
    <li>Each time you press Play, we keep which game, when, and your account if you're signed in.</li>
    <li>
      While you play, your browser tells us every 15 seconds if you're still playing: the tab is showing, the
      game is on screen, and the game has your keys and taps.
    </li>
    <li>
      This is how we measure play time. Members' play time decides how their money is shared between makers,
      and which games come first in the feed.
    </li>
    <li>
      Games run on their own address, ruken.dev. A game never gets your sign-in or your account. A game can
      talk to other websites its maker named, and those websites see your internet address, as any website
      does.
    </li>
  </ul>
  <p><a class="quiet" href="/help/how-the-feed-works">How the feed works</a></p>

  <h2>Games you want</h2>
  <p>Before Ruken opens, you can add games to a list. We keep your list.</p>

  <h2>If you make games</h2>
  <ul class="bullets">
    <li>
      <strong>Your page</strong>: its address, your name, one line about you, your photo, your links and your
      colours. Your page is public.
    </li>
    <li>We count visits to your page and taps on your links. We keep the counts, not who.</li>
    <li>
      <strong>Your games</strong>: the files we copy from your GitHub, your clips, and your answers about each
      game. Staff notes about each game are kept too.
    </li>
    <li><strong>Your GitHub</strong>: which of your GitHub accounts and repositories you let Ruken read.</li>
    <li><strong>The maker agreement</strong>: which version you agreed to, and when.</li>
  </ul>

  <h2>Cookies and your browser</h2>
  <p>
    Ruken has no cookies for ads, and none that follow you to other websites. Until you say "I agree" on the
    notice, Ruken keeps nothing on your browser and writes nothing about your visit. You can take your yes
    back any time on the <a href="/cookies">cookies page</a>.
  </p>
  <ul class="bullets">
    <li><strong>rk_consent</strong> remembers that you said yes, and the day. 180 days.</li>
    <li><strong>rk_session</strong> keeps you signed in. Up to 30 days.</li>
    <li>
      <strong>rk_arrival</strong> remembers the last maker's page or game you opened. 400 days from the last time.
    </li>
    <li>
      <strong>ruken_sign_up</strong> keeps your sign-up going while you type the code we texted. 10 minutes.
    </li>
    <li>
      <strong>rk_welcome_back</strong> says "Welcome back" once, after you undo deleting your account. 5 minutes.
    </li>
    <li>
      <strong>rk_wish_pressed</strong> remembers which game you pressed Wishlist on while signed out, so it goes
      on your list after you sign up. 30 minutes.
    </li>
    <li><strong>thrown-away</strong> tells a maker which game they just threw away. 1 minute.</li>
    <li><strong>page-saved</strong> says "Saved." once, after a maker saves their page. 1 minute.</li>
    <li>
      <strong>rk_seen_hints</strong> and <strong>rk_menu_tab</strong> stay in your browser, only after you say yes,
      and never reach us. They remember that you saw the feed's first hints, and where you put a game's menu.
    </li>
  </ul>
  <p>When you pay, you're on Stripe's own page, and Stripe uses its own cookies there.</p>

  <h2>Who helps us</h2>
  <p>These companies handle some of your details for us:</p>
  <ul class="bullets">
    <li>
      <strong>Cloudflare</strong> runs the website, keeps game files, clips and photos. Its network sees your internet
      address to bring you each page.
    </li>
    <li><strong>Neon</strong> keeps our database.</li>
    <li><strong>Stripe</strong> takes payments and works out tax.</li>
    <li><strong>Twilio</strong> sends our texts and checks phone numbers.</li>
    <li><strong>Resend</strong> sends our few emails.</li>
    <li><strong>GitHub</strong>, for makers only, lets Ruken read the repositories they pick.</li>
  </ul>
  <p>We don't sell what we know about you, and we don't share it for ads.</p>

  <h2>Logs</h2>
  <ul class="bullets">
    <li>
      Ruken keeps no log of visits. What we keep about an account is what this page lists above. Cloudflare's
      network sees your internet address only to bring you the page, and our logs there are switched off.
    </li>
    <li>Nothing about a visit is written down before you say "I agree".</li>
  </ul>

  <h2>How long we keep it</h2>
  <ul class="bullets">
    <li>While you have an account, we keep what this page lists.</li>
    <li>
      When you delete your account, your membership ends at once, with no money back. You're signed out
      everywhere, and every computer you let in is removed. You have 14 days to change your mind: just sign in
      again.
    </li>
    <li>
      After 14 days, we remove your phone number, email, name and age, your page, photo and links, your GitHub
      connection and your list of games. Your games come off Ruken, with their files and clips.
    </li>
    <li>
      Some records stay, with no phone number or email on them: payments, play time, which maker brought you,
      which agreement a maker agreed to, and that texts went out. We need them to keep our money records
      right.
    </li>
    <li>
      If you made games, each game's name and line, the GitHub repository it came from, and staff notes about
      it stay too. A repository's name often holds your GitHub name. So does your page's old address, on the
      records of members you brought.
    </li>
    <li>Stripe and Twilio keep their own records under their own rules.</li>
  </ul>

  <h2>Your choices</h2>
  <ul class="bullets">
    <li>Delete your account: go to You, then "Delete my account".</li>
    <li>Cancel your membership: go to You, then "Change card or cancel".</li>
    <li>Change your password: go to You, then "Change password".</li>
    <li>Remove a computer: go to You, then "Your computers", then "Remove".</li>
    <li>Stop texts: reply STOP.</li>
  </ul>
  <p>
    Before Ruken opens, this page will say how to reach us to ask for a copy of your details, or to fix them.
  </p>

  <h2>Under 18</h2>
  <ul class="bullets">
    <li>Ruken is for people 13 and up. If you're under 13, you can't make an account.</li>
    <li>If you're under 18, or we don't know your age, you don't see games made for adults.</li>
    <li>We keep the same details about you as about anyone else, and nothing more.</li>
  </ul>

  <h2>Changes</h2>
  <p>When Ruken changes what it keeps, this page changes too, and so does the date at the top.</p>

  <p><a class="quiet" href="/terms">Read the terms</a></p>
  <p><a class="quiet" href="/">Back to Ruken</a></p>
</main>
