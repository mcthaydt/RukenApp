# Plan audit: slice 1, the look (branch L)

Date: 2026-11-13. Stage 3 (plan audit) of the look addition to `docs/superpowers/plans/2026-11-13-slice-1-accounts-membership.md` (pull request #22, merged): branch L `slice-1/look`, Tasks 35 to 37, and the "Look" lines on Tasks 18, 19, 27, 29 and 30.

Read against: `CLAUDE.md`, `AGENTS.md`, design 5.2, 5.6, 5.7 and 5.8, the two earlier plan audits, `progress.md`, the code on `main` (branches A to C), and branch D as it stands on pull request #21 (`3cff2b6`: the error page and sign-up are built; sign-in, forgot, reset and `/me` are not yet).

## What was checked, and how

- **No test of this repository ran.** The audit is a reading of the files, plus three measurements made outside the repository.
- **The fonts.** Both tarballs were downloaded with `npm pack @fontsource/young-serif@5.3.0 @fontsource/schibsted-grotesk@5.3.0` into a scratch folder outside the repository. Their `sha512` integrity values equal the plan's. The five files were unpacked and measured with `wc -c` and `sha256sum`. Every size and checksum equals the plan's table: 26,992, 24,344 and 25,180 bytes for the three `.woff2` files (76,516 together), and 4,396 and 4,541 for the two licences. All three fonts start with `wOF2`. Both licences hold the words "SIL Open Font License" on their third line, as the test expects, with that capitalisation.
- **Contrast.** Every pair was measured with WCAG's formula from the design's hex values: chalk on felt 10.94, on felt-deep 13.11, on felt-raised 8.97; sage on felt 6.35, on felt-deep 7.61; ink on paper 15.06; ink-soft on paper 7.18; paper on pip 4.57 (the design sheet's `#c63c26`: 4.48); paper on felt 10.77, on felt-deep 12.91. Every text pair reaches 4.5:1 and every mark reaches 3:1. Pip on felt is 2.36, but pip only ever sits on a paper card.
- **The values in the plan against design 5.8.** All nine colours, the sizes (64/36, 32, 24, 18 at 1.55, 14), the corners (20px, full pill), the press (0.97), reduced motion, the faces and weights, and the "never" list match. Pip is `#c43b26` in the design, the plan's token, its test and its Call.
- **Branch D's markup and CI.** The error page and sign-up as built, the sign-up journeys, and the CI log of the browser job on pull request #21 (run 43522220221).

## Findings

Counts: 1 blocks execution, 8 should fix, 9 notes. Every finding was fixed in the plan except the notes marked "stays", each with its reason. One question went to the coordinator for the Owner (finding 18).

### Blocks execution

**1. The date row has no element to go on, and the sign-up note is bare text.**
- Where: Task 37, the `/sign-up` row of "Each screen"; branch D's `src/routes/sign-up/+page.svelte`.
- What is wrong: the plan says "the element around month, day and year is `row`". Branch D has no such element. The three labels sit straight in the `<fieldset>`, beside the legend and the birthday note. Putting `row` on the fieldset would set the note beside the fields. Task 37 allows adding an element only for a `<main>`, a note or a refusal, so as written the executor must either guess or stop. The password note "At least 10 characters." is also bare text after a `<br />`, not an element.
- Fixed: the three labels go in a `<div class="row">` inside the fieldset, after the legend, and never on the fieldset itself. `.row > *` gets `flex: 1 1 0; min-width: 0`, so three fields share a phone's width. The password note becomes `<small class="note">` in place of the `<br />` and the bare words, and `.note` is `display: block`. No word, label or role changes.

### Should fix

**2. A link that looks like a button is neither 48px tall nor gives when pressed.**
- Where: Task 37, the `button, .button` rule.
- What is wrong: an `<a>` is inline. On an inline box `min-height` does nothing, vertical padding does not take up space, and `transform` does not apply. So "Back to Ruken" (the error page, under 13, `/goodbye`), "Send a new link", "Keep playing", "Join Ruken" and "Go to my account" would fall below the 48px target the plan promises the grandma, and would not give when pressed. No journey measured an `a.button`, so CI would have passed.
- Fixed: `button, .button` are `display: inline-flex`, with their contents centred. A new journey, "a link that looks like a button is as easy to hit, and gives when pressed", checks "Back to Ruken" on the missing page: an ink fill, at least 48px tall, and scaled to 0.97 while pressed.

**3. Inside a paper card the browser draws for a dark page.**
- Where: Task 35, `color-scheme: dark` on `:root`; Task 37, `.card`.
- What is wrong: with the whole page dark, Chromium draws its own parts of a form for a dark surface, even on a paper card: unchecked radio buttons on the paywall card get dark fills, and a field the browser fills in from saved details gets light words. On a saved sign-in, that would mean light text on paper: unreadable, on the screen a tired person uses most.
- Fixed: `.card` gets `color-scheme: light`, written up as a Call ("The page is dark, and a card is light"). The page stays one dark theme, as 5.8 says.

**4. The look's journeys made more accounts than the sign-up limit allows.**
- Where: Task 37's `CARD_SCREENS` ("your account") and the quiet-button journey, and the `CARD_SCREENS` additions in Tasks 19, 29 and 30.
- What is wrong: better-auth allows five sign-ups an hour from one address (`"/sign-up/email": { window: 60 * 60, max: 5 }` in `src/features/accounts/auth.ts`), and every journey comes from one address. Branch D's browser job already hits this limit. In run 43522220221 the first four sign-ups pass and the next four fail ("next pointing off the site", "an address that already has an account"). Branch L as planned added two accounts per project, and Tasks 19 and 30 added three more per project.
- Fixed: `CARD_SCREENS` holds only screens reached without making an account. A new helper, `expectOneCard(page)`, does the same checks inside a journey that already has an account. "your account" is checked in the same journey as the quiet button, so branch L makes one account per project. Tasks 19 and 30 check their screens inside journeys they already have. How branch D settles the limit in CI is branch D's (reported to the coordinator, not fixed here). L follows it, and stops and reports if a look journey is refused a sign-up.

**5. A check of "Finishing up…" would run across the page moving on by itself.**
- Where: Task 29, its Look line.
- What is wrong: "Finishing up…" moves on to `/me` by itself. A `CARD_SCREENS` entry runs `page.evaluate` checks (`pipRed`, the sideways check), and an evaluate that is running when the page moves can fail with nothing wrong in the page. That is a flaky check.
- Fixed: the third test checks the card's ground and its heading size with `toHaveCSS` only. Both checks wait, and both also hold on `/me`.

**6. "The face is really loaded" proved nothing.**
- Where: Task 36, the first journey.
- What is wrong: `document.fonts.check()` answers `true` for a family that has no face at all, so the assertion passed whether or not Young Serif was loaded. Also, `page.evaluate(() => document.fonts.ready)` hands back a `FontFaceSet`, which cannot be passed back to the test.
- Fixed: the journey uses `document.fonts.load('400 32px "Young Serif"')` and expects the statuses `["loaded"]`. Each wait is written `async () => { await document.fonts.ready; }`.

**7. Task 35's red step did not name every case that passes.**
- Where: Task 35, Step 2.
- What is wrong: besides "is measured the way WCAG measures it", the case "ask nothing of another site, and add no package" also passes against an empty stylesheet. The step said only the first passes, and "How a task runs" stops on any other outcome.
- Fixed: Step 2 names both passing cases, for the report line.

**8. Margins were left to the browser.**
- Where: Task 36, the `h1` and `p` rules.
- What is wrong: the plan sets only the space above a paragraph and above a heading. The browser's own margins stay: 0.67em under a heading (43px under the 64px one) and 1em under every paragraph, which leaves a gap inside the bottom of each card. CI does not see this, and it is the Owner's first look.
- Fixed: `h1 { margin: 0 }` and `p { margin: 1rem 0 0 }`. Space comes only from the plan's own rules.

**9. The Owner's first look points to a step that does not ask for it.**
- Where: branch L's opening ("after Task 16 step 5"); Task 16, Step 5.
- What is wrong: Task 16 step 5 was about the deploy and a real sign-up, and said nothing about a look.
- Fixed: Step 5 now asks, through the coordinator, for the Owner's first look on a phone and a computer, at the screens L styled. What the Owner says is a note for a small fix branch, and does not hold branch F. Finding 18 asks whether the look should come earlier.

### Notes

**10. A ninth class.** The look says "eight classes … nothing else", while Task 18 adds `panel`. Fixed: the look section says `panel` arrives with Task 18, and how any later class arrives.

**11. Calls the design does not give.** The statement's leading (1.2), the press time (160ms) and the home page with no card were in the plan but not among its Calls. Fixed: each is listed as a Call.

**12. Words in comments.** The "none of what the design rules out" check reads the whole stylesheet, comments included. A comment such as "no box-shadow" would fail it. Fixed: Task 35 says to write such things in words.

**13. "pay" as a whole name.** `screensUsing("pay")` could match a longer class name that contains "pay". Fixed: it splits `class="…"` on spaces and matches whole names.

**14. "Every button still works" with no fonts.** The journey checks that the button is there and enabled, not that it does its job. Pressing it would spend a reset request against its own limits. Fixed: Review Focus 13, the grandma line and the journey's name now say "there to press".

**15. The long address.** Its part before the `@` was 85 characters, over the 64 an address may have, so a server-side check could refuse it and fail the journey for the wrong reason. Fixed: 51 characters, 92 in all, still far wider than a phone.

**16. `:active` on the phone project.** Stays. Playwright's `phone` project (Pixel 7) turns on touch, but `page.mouse` still sends mouse events, and those set `:active`. Real Chrome on Android also shows `:active` on a touch. Task 37 already says what to do if "pressing a button" fails on `phone` only: report it with the value, and do not drop it.

**17. Cloudflare and the later routes.** Stays, confirmed by reading:
- **Cloudflare.**
  - The adapter copies `static/` into `.svelte-kit/cloudflare`, which `wrangler.jsonc` names as `assets.directory` (Task 34). Cloudflare answers a static file before the Worker runs, and `vite preview` (the journeys until Task 34) does the same.
  - Branch L touches nothing in E0. Task 34's green push is the first real proof under `wrangler dev`, and it already stops on a wrong font address or `content-type`.
  - That Workers send `font/woff2` for `.woff2` was not measured in this audit.
- **The later routes.**
  - The "no style, no colour, only the look's classes" check does not catch Svelte's `{#if}`, `{#each}` or `{#await}`: none of them is a hex colour.
  - The Look lines of Tasks 18, 19, 27, 29 and 30 use only the look's classes plus `panel`, which Task 18 adds to `CLASSES`.
  - Task 27 writes the paid button and the plain one as two buttons in an `{#if}`, never as a computed class.
  - `pay` stays on exactly one button.
- **The grandma test.** It still holds on every screen: one filled button per card, red only on "Continue to payment", text 18px at 4.5:1 or more, 48px targets (with finding 2), nothing sideways, and nothing moving under reduced motion. No word changes.

**18. Who looks before the look merges.** Sent to the coordinator for the Owner; this pull request stays a draft until the answer.
- What the rules say: CLAUDE.md puts work judged by looking (UI, layout) on the Owner's computer, and says to look at the real expected, actual and diff images before accepting a visual change.
- What the plan does: branch L runs in the cloud and merges on measured values, and nobody sees an image until the real site.
- Options sent:
  - A. As planned, with the Owner's look at Task 16 (finding 9).
  - B. The Owner looks in a local session before L merges.
  - C. Recommended: L's journeys attach a phone and a computer screenshot of each screen to the Playwright report. The browser job keeps the report on every run, a one-line `ci.yml` change that needs the Owner's words. The Owner sees the images from L's green run before L is marked ready.
- The plan carries A until the answer, which is recorded below.

## The design

No change is needed in design 5.8. Its values, its contrast claims and its "never" list hold as measured above.
