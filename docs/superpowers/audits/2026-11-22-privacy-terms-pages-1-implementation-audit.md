# Privacy and terms pages: implementation audit 1

**31546ab FAIL: 6 red**

- Examined: branch `claude/project-thread-xa97zr` at 31546ab (merge base with main c556cc0). Main is now 23d178f; `git merge-tree` merges it cleanly, and nothing main gained since c556cc0 (frosted glass, CI) adds a cookie, a browser-kept value, an outside service or a kept field.
- Lane 2, one fresh review (CLAUDE.md, Settings). Reviewer: Opus 5.5, medium. Audit only; nothing but this file changed.
- Brief: the owner's request (2026-11-22 16:41 UTC) and the six criteria in `/mnt/project-files/pr-drafts/privacy-terms-pr-body.md`.

## What ran

- `pnpm exec vitest run tests/routes/privacy/cookies.test.ts`: 3 passed.
- `pnpm exec playwright test tests/browser/legal-pages.test.ts --project=tablet --project=computer` against `wrangler dev` and a local Postgres 16: 6 passed. The phone (WebKit) project was not run here; it runs in CI.
- A throw-away probe (not committed) opened /privacy and /terms on tablet and computer, read the computed style of the first list and took full-page shots (R5).
- Not run: `look.test.ts` and `look-layout.test.ts` (criterion 4); CI will run them.

## Checks that pass

- **Rule mix.** The `.claude/skills/this-repo/SKILL.md` line does not trip the hook: `ruleMix.rulePaths` in `.claude/hooks/rules.json` lists CLAUDE.md, the shared skills and `.github/workflows/**`, not `this-repo`, so `ruleMixFiles` finds no rules file in this diff. `prFlow.lanePathsExcept["3"]` also leaves `this-repo` out of lane 3. The line takes this change's lane, and the PR body names it, as CLAUDE.md (A repo's own skills) asks. It stays in this pull request.
- **Marked for a lawyer.** Each page opens with "This is a draft. A lawyer has not checked it yet." Terms has a "Waiting for a lawyer" section for refunds, liability, governing law, disputes and contact. The PR body lists 15 open legal questions.
- **No guessed law found.** The pages state facts and leave legal outcomes to the lawyer. Two lines read like legal terms and belong on the lawyer's list (notes N3).
- **E2E on every device.** `playwright.config.ts` runs every file in `tests/browser` on phone (iPhone SE, WebKit), tablet (iPad, Chromium) and computer, with no `testIgnore`. `legal-pages.test.ts` and the two new `CARD_SCREENS` entries are picked up by all three.
- **No CRUD gap.** The pages add nothing a person makes.
- **Claims that match the code** (checked line by line): phone, password (hashed by better-auth; the pending sign-up keeps only a hash), date of birth used once and only `adultOn` kept (`age.ts`); under 13 refused before anything is kept or a cookie is set (`forms.ts:265`); `paperEmail` from Stripe Checkout and used only for the reset code (`auth.ts:133`); sessions hold IP and user agent, 30 days renewed daily (`auth.ts:194`); per-address limits under a day (`rate-limit.ts:17`); the 1-hour pause keyed by a keyed hash of the number; Twilio Lookup on reset (`changed-hands.ts`); texts only on the account line, since nothing sends on `news`; `TextSent` holds no number; US and Canada only (`phone.ts:63`); plan, state, renewal and per-payment gross, tax and card fee; Stripe events kept without email, name or address (`kept-event.ts`); 15-second beats with tab, frame and focus (`play/+page.svelte:94`), members' attentive beats ordering the feed and splitting the pool; game files on their own origin with `connect-src` limited to the maker's hosts (`gate.ts:166`); page views and taps kept as counts only (`pages/service.ts:270`); 18+ games hidden from anyone not known to be 18 (`adults.ts`, `feed/service.ts:41`); $9.99 and $99, tax exclusive with `automatic_tax`, no trial (`plans.ts`, `checkout.ts`); deletion ends membership now and signs out everywhere (`me/delete/+page.server.ts`); the button labels "Delete my account", "Change card or cancel" and "Change password" exist on /me; no pornography or gambling (`send-back-reasons.json`); no outside script, font or analytics in `app.html` or `package.json`.

## Red findings

### R1. Two cookies are missing from the list

UNIT: `src/routes/privacy/+page.svelte` (Cookies and your browser) and `tests/routes/privacy/cookies.test.ts`.
VERDICT: red.
REQUIREMENT: criterion 2 (every claim matches main) and the new this-repo rule ("sets a new cookie … updates the page").
REASON: the page lists every cookie but two, and the check cannot see either because they do not start with `rk_`.
EVIDENCE: `src/features/accounts/forms.ts:45` sets `ruken_sign_up` (path `/sign-up`, 600 s, `forms.ts:46-48`, `:285`), which ties a sign-up in progress to the browser. `src/routes/make/page/page-words.server.ts:6,10` sets `page-saved` (path `/make`, 60 s), which shows "Saved." once. Neither name is on the page. The test scans only `/\brk_[a-z_]+/` and checks one other name, `thrown-away`, by hand.
EXPECTED: the page lists `ruken_sign_up` ("keeps your sign-up going while you type the code. 10 minutes.") and `page-saved` ("says 'Saved.' once after a maker saves their page. 1 minute."). The check fails on any cookie or browser-kept name the page does not list, whatever its prefix.
FIX: add the two lines to the page. In the test, also collect the first argument of every `cookies.set(` and `localStorage.setItem(` / `sessionStorage.setItem(` call, resolving a constant name the way `thrown-away` is resolved now. Show it failing by removing one of the two new lines. Files: the privacy page and `tests/routes/privacy/cookies.test.ts`.

### R2. "Logs" says notes are written only when something goes wrong

UNIT: `src/routes/privacy/+page.svelte` (Logs).
VERDICT: red.
REQUIREMENT: criterion 2; nothing promised ahead of the code.
REASON: the site logs every request, and writes some notes when nothing has gone wrong.
EVIDENCE: `wrangler.jsonc:18` has `"observability": { "enabled": true }` with no `invocation_logs: false`, so Workers Logs keeps an entry for every request, with its address, path and headers. `src/routes/make/github/callback/+server.ts:36` writes a `console.info` on every successful GitHub connection, naming the maker's GitHub account logins.
EXPECTED: the page says what is logged today, for example: "Cloudflare keeps a short record of each visit: the page, the time, your internet address and your browser. When something goes wrong, the website adds a note about it. When a maker connects GitHub, we note which GitHub accounts it showed." How long Cloudflare keeps these stays an open question (PR body question 8).
FIX: reword the Logs section only. Changing what is logged belongs to the consent-gate thread and is out of scope here. File: the privacy page.

### R3. `rk_arrival` is set by every game page, not only by a maker's link

UNIT: `src/routes/privacy/+page.svelte` (Which maker brought you; Cookies and your browser).
VERDICT: red.
REQUIREMENT: criterion 2.
REASON: the page says the cookie comes from "a maker's page or a link to their game" and lasts "until you open another maker's link". The code sets it, and starts its 400 days again, on every load of any game's page.
EVIDENCE: `src/routes/g/[game]/+page.server.ts:37` calls `arrival.remember` on every load of `/g/<game>`, which is where a tap on a feed video goes, and `src/routes/[handle=handle]/+page.server.ts:18` does the same on every maker page. `services.ts:156` sets `maxAge` 400 days each time.
EXPECTED: "When you open a maker's page or any game's page, also from the feed, we put a small file (a cookie) in your browser. It remembers the last maker whose page or game you opened, and when. It lasts 400 days from the last time, and the next maker's page or game you open replaces it." The cookie list says "the last maker's page or game you opened".
FIX: reword those two places. File: the privacy page.

### R4. After deletion, records with a GitHub name stay, and the page says none do

UNIT: `src/routes/privacy/+page.svelte` (How long we keep it).
VERDICT: red.
REQUIREMENT: criterion 2.
REASON: the page says the GitHub connection is removed and that the records left have "no name or number on them". The purge keeps each game's row, including the GitHub repository's full name (`owner/repo`, where the owner is usually the maker's GitHub login), the game's name and one line, and staff's review notes.
EVIDENCE: `src/features/accounts/deletion.ts:205-246` (`takeGamesOff`) changes the state, slug and pull ids but keeps `repoFullName`, `repoBranch`, `name`, `oneLine` and `connectHosts` (`prisma/schema/games.prisma:73-91`). `GameReview` and `GameReviewPart.note` stay. Other people's `MembershipStart.arrivalPath` and `CheckoutIntent.arrivalPath` keep `/<handle>`, the maker's page address.
EXPECTED: the "Some records stay" line also names, for makers: "each game's name, its line, which GitHub repository it came from, and staff notes about it". Or the purge clears those fields, but that changes code in a lane 3 path and is the owner's call, so the wording fix is the one in scope.
FIX: add the maker clause to that line. File: the privacy page.

### R5. The lists use the browser's own margin, indent and bullet

UNIT: `src/lib/look.css` (card lists), shown on `/privacy` and `/terms`.
VERDICT: red.
REQUIREMENT: the owner's rule (2026-11-22 15:51 UTC, "EVERYTHING should be custom", no built-in browser look) and look.css's own rule that "space comes only from the rules here".
REASON: neither page has a list style of its own, and look.css styles only `.card ol` and `.card nav ul`, so every `<ul>` on both pages falls back to the browser's defaults.
EVIDENCE: computed style of `main ul` on /privacy and /terms, tablet and computer: `list-style-type: disc`, `padding-left: 40px`, `margin-top: 16px`. The shot shows default disc bullets, indented 40 px. `.card li + li { margin-top: 1.75rem }`, meant for the maker agreement's numbered points, also puts 28 px between one-line bullets.
EXPECTED: a `.card ul` rule in look.css sets its own margin, indent, marker and gap between items, in the house type and spacing, and leaves `.card nav ul` and `.card ol` as they are.
FIX: one rule block in `src/lib/look.css` (lane 2 path, which this pull request's lane already covers). Shoot /privacy and /terms on all three devices after, as `visual-check` says. Files: `src/lib/look.css` only.

### R6. The page's comment points at a test file that does not exist

UNIT: `src/routes/privacy/+page.svelte:5`.
VERDICT: red (low).
REQUIREMENT: criterion 2; the comment is the pointer the next editor follows.
REASON: it names `tests/routes/privacy-cookies.test.ts`, but the file is `tests/routes/privacy/cookies.test.ts`.
EVIDENCE: `ls tests/routes/privacy/` shows `cookies.test.ts`, and there is no `tests/routes/privacy-cookies.test.ts`.
EXPECTED: the comment names the real path.
FIX: correct the path. File: the privacy page.

## Notes (not blocking, recorded)

- N1. During sign-up, for up to 10 minutes, Ruken keeps a hash of the number, the hashed password and `adultOn` (`PendingSignUp`), and better-auth keeps the code by the plain number (`Verification`, `auth.ts:151`). The page could say "While you sign up, we keep what you typed for 10 minutes, until you type the code." Worth adding, but nothing on the page is wrong without it.
- N2. "When you cancel, you keep playing until the end of the time you paid for" and "Stripe emails your receipts" depend on settings in Stripe's dashboard (the portal's cancel mode, customer emails), not on code (`subscription.ts:90`: "What the portal offers is set in Stripe's own settings"). Check both in Stripe before launch.
- N3. For the lawyer's list: Terms' "Where this page and the agreement differ, the agreement wins" and "What happens on your account is up to you" are legal terms, not facts.
- N4. On https the session cookie is really called `__Host-rk_session` (`cookies.ts:26`). The page's `rk_session` is close enough for a reader, but a lawyer may want the exact name.
- N5. Terms says "Playing needs a membership". Before launch (30 November) the public sees Wishlist and nobody pays to play. Terms could say so once, as privacy's "Before Ruken opens" line does.
- N6. `WishlistMail` (a launch email) exists in the schema but nothing sends it yet. When it ships, the email section changes (this-repo rule).

## Verdict

**31546ab FAIL: 6 red** (R1–R6). R1–R4 and R6 are edits to the privacy page, plus a wider check for R1. R5 is one rule block in `src/lib/look.css`. None needs an owner choice. The rule-mix question is settled: the this-repo line stays in this pull request.
