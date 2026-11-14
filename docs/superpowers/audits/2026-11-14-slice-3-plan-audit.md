# Slice 3 plan audit: the feed and the maker's page

Date: 2026-11-14. Stage 3 (plan audit), on branch `audit/slice-3-plan`.

What was audited: `docs/superpowers/plans/2026-11-14-slice-3-feed-maker-page.md` as merged in pull requests #53 and #54 (`main` at `527bca3`). It was read against `CLAUDE.md`, `AGENTS.md`, the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`), the whole of slice 2's plan and the relevant parts of slice 1's, the five earlier audits, `docs/superpowers/progress.md`, and the code on `main` (slice 1; slice 2's branches A to D and Task 29). Slice 2's branch E is pull request #52 and was not read as code.

Line numbers below are the plan's unless a file is named.

What was run, and what was not:

- No test of this repository was run (CLAUDE.md: tests run only on GitHub's runners). This audit is a reading of files.
- In a scratch folder outside the repository, the two packages the plan copies from were downloaded with `npm pack`, and one small script read the colour data. Nothing was added to the repository or to `package.json`.
- The plan itself is not changed in this audit. Each finding has a proposed fix for the coordinator to send back to a plan session, or to the execution session as a written deviation.

Counts: **0 block launch, 14 should fix, 18 notes.**

## What was measured

- `dictionary-of-colour-combinations` 1.0.2: the tarball's integrity is `sha512-7IiYWH/oZvfx…ce6Vp4w==`, `package/colors.json` is 60,245 bytes with SHA-256 `555f11c3…ee2703b4`. All three equal "Found while planning", 1 (line 59). No two colours share a hex value.
- The plan's `arrange` rule (line 263), run over all 348 combinations: **135 are offered** (the plan's stop line is 50, line 301). One offered combination holds Scarlet `#cb2f43`, the `pip` colour (N3). Task 3 still records the number from CI; this one is a check, not the fact of record.
- `simple-icons` 16.37.0 (the newest today; `license: CC0-1.0`, `LICENSE.md` starts "CC0 1.0 Universal"). Each mark has one `<path>`. Nine of the plan's ten site ids are file names in `icons/`. **`itch` is not; the file is `itchdotio.svg`** (S5).
- The base64 PNG in Task 25 (line 1203) decodes to **70 bytes**, not 67 (S12).
- `ink` at 60% over white is **rgb(112, 113, 114)**, not (112, 113, 113) (line 657). Chalk on it is 4.89:1, so the rule holds (S11).

## What was checked and holds

- **Slice 2's interfaces.** Each piece in "What this plan relies on" (lines 34 to 51) exists under that name and shape. Some are on `main` today: `LiveGame`, `liveGameBySlug`, `gamesServices(): { service; address }`, `GameError`, `isClipKey`, `handleGameRequest` with its clip step, `FileStore`, `purgeDueAccounts`, `chicagoDayOf(epochMs)`. The rest are in slice 2's plan: `GameReview` (`gameId`, `decision`, `decidedAt`, add-only) in Task 26; `PlaySession` (`gameId`, `basis`) and `PlayBeat` (`sessionId`, `receivedAt`, `attentive`) in Task 16; `isPhone` and `backFromPaywall` in Task 17, re-exported by `play.ts` in Task 18; `createPlayService` in Task 18; the browser-entry rule in Task 22; `/g/[game]` in Task 20; `addGame` answering `{ slug, name, publicId, makerEmail, makerUserId }` in Task 30; `signInAs` in Task 31. `take-off.test.ts` is Task 31's. Two small differences: `purgeDueAccounts`'s deps are `{ prisma, clock }` (`src/features/accounts/deletion.ts:97`), and the plan's `tx.makerPage` line fits that. The size formatter Task 20 asks to export is `megabytes` in `src/features/games/files-check.ts` (N9).
- **Branch order against slice 2's.** Slice 2 merges A, B, C, D, E, M, P, S, F, G, one after another. Slice 3's C waits for M, P and S (`GameReview` and `accept` are M; taking off and putting back is S; the beats are P). D waits for F. G waits for slice 2's D, which is merged. H waits for B and D, and I for G and H. None of them needs a slice 2 branch before it can merge. A and B need only slice 1. Two pull requests are open today (#52, #55), so A and B side by side stays within three.
- **Feature folders and layers.** `FEATURE_ORDER` on `main` (`tests/architecture.test.ts:12`) already holds `pages` above `play` and `money`, and `feed` above `pages`. The new code sits in `src/features/pages/` and `src/features/feed/`, with data in each feature's `library/`. Shared helpers (`colour.ts`, `random.ts`) go in `src/lib/`, as CLAUDE.md lists. Tests go in `tests/`. The gate still imports no feature (Task 21).
- **No new package.** The colour data and the icons are copied as files, each with its licence and a source record, as the Owner's "Real icons" asked. Neither package goes in `package.json`.
- **The look decisions.** The palette tokens on `main` (`src/lib/look.css:42-53`) are the ten the plan names. `--radius-button` is 12px and `--radius-card` 20px, and the plan uses both for buttons and cards. "Continue to payment" stays `pay` Blue (line 29). The pip is one 12px mark on the price card only, never on a button, and not on a member's or a paused membership's card (Task 19). Task 13's band and the feed's Play take the tokens through custom properties.
- **The maker's photo on the gate** (Owner: "Yes"). Task 21 adds one written-out key pattern beside the clip pattern, served as a clip is, with a test that ties it to `isPhotoKey`. `servedTypeFor` already knows `png`, `jpg`, `jpeg` and `webp` (`src/lib/files/content-types.ts:25-28`).
- **Owner steps.** There are none in this slice (line 97): no setting, secret, bucket or address. So no command needed checking against the Owner's shell.
- **Nothing that is strategy.** The Calls give product reasons only: what a screen does and why it works that way. No market, competitor, forecast or business reason appears.
- **Tests first.** Every task has a red push with stubs, then a green one. Task 27 is the one test with no red, and it says so, as slice 2's Task 23 did.
- **The Calls.** Each is consistent with the design and with the others:
  - the feed order: new for seven days from the first acceptance, then members' beats over seven days, ties broken by a seed of the Chicago day;
  - fifty games at most;
  - the `/join` clip, a backdrop shown only for a live game's play address;
  - the address rules (3 to 30 characters, the reserved list tied to `src/routes/` and `static/` by a test). The words reserved today are all on the list: the routes on `main`, slice 2's `g`, `make`, `legal` and `admin`, and `fonts`.

## Findings

### Blocks launch

None.

### Should fix

**S1. Share's status line and the hints collide on the first clip.**
- Where: Task 14's journey (lines 707 to 715); Task 17 (line 786).
- What is wrong: the hints are a `<div role="status">` inside the first clip. They show in every new browser context and stay until a scroll, a key or Sound. Task 14's journey opens `/`, where a just-made game is usually the first clip, and clicks Share. Clicking Share does not take the hints away. From Task 17 on, `clip.getByRole("status")` then finds two elements. Playwright's strict mode fails `toHaveText`, and the later `toHaveCount(0)` fails because the hints are still there.
- Fix: in Task 14, find the line by its words: `clip.getByRole("status").filter({ hasText: /^(Link copied\.|Copy the address from the bar at the top\.)$/ })`. Or open the feed at a second game so the clip is not the first. Task 17 should name this interaction so the session does not discover it in CI.

**S2. An address stored "as typed" can pass `cleanLinkUrl` and still fail the database or the redirect.**
- Where: Task 6, `cleanLinkUrl` (line 380); Task 4's `PageLink_url_check` (line 321); Task 22's `/out/` redirect (line 974).
- What is wrong: `new URL` follows WHATWG parsing. It lower-cases the scheme, reads `\` as `/` for https, accepts `https:example.com`, and silently drops tabs and newlines inside the address. So each of these passes `cleanLinkUrl` and is stored as typed:
  - `HTTPS://example.com`, `https:\\example.com` and `https:example.com` then fail the case-sensitive CHECK `"url" ~ '^https://'`. That is a Prisma error, which reaches the maker as "Something went wrong" instead of the refusal's words. It fails the drunk-grandma test.
  - An address with a newline inside it is stored, and `redirect(303, url)` throws on the invalid header, so every tap of that link answers 500.
- Fix: store `new URL(trimmed).href`, the parsed form, which always starts `https://` and holds no control characters. Or refuse any typed address that does not start with lower-case `https://` or that holds whitespace or control characters. Add `HTTPS://example.com`, `https:\\example.com` and `"https://exa\nmple.com"` to Task 6's cases. Review Focus 5 should name them. The test "keeps a good address as it was typed" changes with whichever rule is picked.

**S3. Hovering a link runs the page's load: views are counted and arrivals set without a visit.**
- Where: `src/app.html:8` (`data-sveltekit-preload-data="hover"`, on the whole body); Task 22's `load` (line 973: `arrival.remember`, `countView`); Task 13's `@<handle>` link (line 613); the maker page's Play links (line 975).
- What is wrong: SvelteKit preloads a page's data, server `load` included, when the pointer rests on a link to it. On a computer, a mouse passing over `@maker` in the feed counts a view of that page and replaces the visitor's arrival cookie. Neither the count nor the arrival is real. The arrival decides which maker a member's sign-up is credited to (design 8). The same happens for a feed's or a page's Play link: `/g/<slug>/play`'s load starts a play session and hands out a pass (slice 2, Task 21), on hover.
- Fix: put `data-sveltekit-preload-data="off"` on the feed's band and account link and on the maker's page links that lead to a load with an effect: `@<handle>` and every Play. Or set it once on the feed's `<main>` and the maker page's `<main>`. Add a journey per screen: hover `@<handle>`, then `pageCounts(handle).views` is 0 and no `rk_arrival` cookie is set. Report the Play-on-hover part to slice 2's merge path as a second problem (CLAUDE.md, Scope). It is slice 2's route, but slice 3 multiplies its links.

**S4. The paper card on a maker's page, which the Owner asked for, is not in the plan.**
- Where: design 5.8, line 250 ("the paper card is the one thing shared by every surface: the paywall card over a dimmed clip in the feed, the cards on Ruken's own screens, and the maker's page"); `progress.md:233`; the plan's Owner bullet (line 70) and Task 22's styles (line 976).
- What is wrong: the plan's maker page has game cards and "game somewhere else" cards with 20px corners in the theme's button colours. It says nothing of the paper card the Owner said ties the three surfaces together, so the Owner's 2026-11-14 decision is not carried. It may be met by the card's shape alone (20px, no border, no shadow, a tone step) or may mean a paper surface. The plan does not say which.
- Fix: the plan session writes the Owner's line into "The Owner's decisions" and says how the maker's page carries it.
- Answered: Owner, 2026-11-14 (relayed by the coordinator): "Page's own colours". On a maker's page, the cards keep the paper card's shape (20px corners, no border, no shadow) but are filled with the colours the maker picked. Task 22's styles already do this. What is left is to write the Owner's answer into the plan's decisions, and to name it in Task 22's styles.

**S5. The itch.io mark is named wrong, so Task 23 stops at once.**
- Where: Task 23 (lines 1042 to 1045).
- What is wrong: the plan copies each mark from "the package's `.svg`" by site id, and stops if one is missing. `simple-icons` names the file `itchdotio.svg`; there is no `itch.svg` (measured, 16.37.0).
- Fix: give each site's package file name beside its id (`itch` ← `icons/itchdotio.svg`; the other nine match their ids). Keep the stop rule for a mark that is really missing.

**S6. Nothing says where a social mark's path data reaches the page.**
- Where: Task 23 (lines 1046, 1047).
- What is wrong:
  - `pageByHandle`'s links gain `social: { id, name }` and no path.
  - `MakerPage.svelte` draws `<path d={…} />`, but no step says which module reads `library/social-icons.json` or how the path reaches the component.
  - The layer rule lets only `pages` read its `library/`, and a component may reach its feature only through `pages.browser.ts`.
- Fix: say it. Either `links.ts` (which a browser may bundle) exports `SOCIAL_ICON_PATHS` from the JSON and `pages.browser.ts` re-exports it for `MakerPage.svelte`, or `pageByHandle` puts `path` in `social`. The first keeps ten paths out of every page's data.

**S7. A small icon still needs a name that is never shown.**
- Where: Task 26's form (lines 1229 to 1236); `addLink` and `linkProblem` (lines 381, 416); Task 23 (line 1047: the icon is named by the site, `aria-label="<site name>"`).
- What is wrong: for "A small icon, for YouTube, Discord and the like", the maker must still fill "Name", or be told "Give the link a name." Nothing shows that name: the mark is labelled by its site. That fails the drunk-grandma test (a field that does nothing), and it breaks the design's rule that onboarding never asks for anything the next step does not need.
- Fix: for kind `social`, the title is the site's name, set by the service from `socialSiteOf`. The form says "Name (not needed for a small icon)", or hides the field with script and sends nothing. `linkProblem` checks the title only for the other two kinds. Add one case to Task 23's service test and one to Task 26's journey.

**S8. The colour picker is 136 tiles named by number.**
- Where: Task 25, `ThemePicker.svelte` (line 1162); the 135 offered combinations measured above.
- What is wrong:
  - A screen reader reads "Colours 37", "Colours 38" … 135 times. A number says nothing to anyone, which fails the drunk-grandma test for the people who most need the words.
  - The data holds each colour's name ("Scarlet", "Blue"), and Task 1 keeps `name` in `WadaColour`.
- Fix:
  - Name each radio by its colours, for example "Scarlet, Blue and White". `Theme` gains `names: string[]` from `coloursOf`'s colours.
  - Say how 136 tiles sit on one card on a phone: a grid of several per row, each 48px tall.
  - Have the screenshot step show the Owner the whole list. The Owner may prefer fewer.

**S9. An SVG would be redrawn as a JPEG in the browser and pass, against Task 25's own test.**
- Where: Task 25's photo script (line 1185) and its journey (lines 1206, 1207).
- What is wrong: the script draws any chosen picture onto a canvas and sends a JPEG. A browser decodes an SVG into an `<img>` happily. So with script, a chosen `.svg` arrives at the server as a valid JPEG and is stored. The journey expects "A photo is a JPEG, PNG or WebP picture." and fails. The result is safe (a redrawn bitmap), but it is not what the plan says.
- Fix: the script redraws a file only when its `type` is `image/jpeg`, `image/png` or `image/webp`; anything else is sent as chosen, and the server's words answer it. Say so in Task 25, with the reason.

**S10. Removing the placeholder home page drops more checks than the plan lists, one of them the only proof the heading face loads.**
- Where: line 675 ("`look.test.ts` loses its case for that page"). On `main`:
  - `tests/browser/look.test.ts:16`, "the page is felt, with chalk words in Young Serif", which also proves the Young Serif face is really loaded and checks the 64px/36px section heading;
  - `tests/browser/look.test.ts:91`, "the home page sits on the felt, with no card and no red";
  - `tests/browser/look-layout.test.ts:228-254`, the `home` describe: three cases.
- What is wrong: the plan names one case. Five depend on the placeholder. The first carries checks that are not about the home page: the felt body, the font really loaded, and the section heading size. Dropping it with the page loosens the look's tests without a word, which CLAUDE.md forbids.
- Fix: list all five. Say that the felt, chalk and font-loaded checks move to another screen, for example `/sign-in`, with its card title in Young Serif. Say whether the 64px/36px section-heading size still has a screen. If none uses it, the look's own test of `--text-section` stays and the report line says the browser check went with the page. The pressed-wordmark case (`look-layout.test.ts:181-185`) still expects `/` and passes unchanged.

**S11. A hand-written colour in Task 13's test is wrong.**
- Where: line 657 ("mixed over white that is rgb(112, 113, 113)").
- What is wrong: 0.4 × 255 + 0.6 × 20 = 114, so the blue channel is 114. A test that writes the plan's number fails. A session that "fixes" the test toward the plan writes a wrong fact. CLAUDE.md: facts are measured, never written by hand.
- Fix: the test works out the mix from the band's computed colour and the paper token, then measures chalk on it with `contrast`. No literal channel values.

**S12. The test PNG is 70 bytes, not 67.**
- Where: Task 25 (line 1203).
- Fix: drop the byte count, or write 70 and check it in the helper (`expect(bytes.length).toBe(70)`), so the number is measured.

**S13. Task 27 leaves out one of design 8's lines that this slice completes.**
- Where: Task 27, step 2 (line 1285); design 8, line 357: "Staff accept it, and it appears in the feed and on the maker's page."
- What is wrong: slice 2 proves acceptance and the game's page. Only slice 3 can prove "appears in the feed and on the maker's page". `addGame` accepts through the staff screen, and Tasks 13, 22 and 27 then find the game in the feed and on the page, but the line is not named in the tracker. So design 8's checklist would show it as not covered.
- Fix: Task 27's journey asserts both places for the game `addGame` accepted, and step 2 names the line.

**S14. `memberBeatsByGame` is said to be "one indexed sum"; the indexes do not serve it.**
- Where: the Call (line 78) and Task 10 (line 501); slice 2's Task 16 indexes: `PlayBeat (sessionId, receivedAt)`, `PlaySession (gameId, startedAt)` and `(userId, startedAt)`.
- What is wrong:
  - The query selects beats by `receivedAt >= since` across all sessions. No index leads with `receivedAt`, so Postgres reads every beat, or every session and then its beats. That happens on every open of `/` (the plan's own last note, line 1296, half says so).
  - The Call also says beats order games "the same way counted time would". They do not always: a lost beat counts up to 45 seconds of time but one beat. "Nearly the same way" is true.
- Fix:
  - Bound the sessions too: `PlaySession.startedAt >= since - PLAY_SESSION_LIFE_MS`. A session takes beats for 24 hours only, so nothing is lost. Join on that, which uses `(gameId, startedAt)`.
  - Reword the comment and the Call: "nearly the same order as counted time, at a fraction of the cost". Keep the "a sum kept per day" note.

### Notes

**N1. The feed at `/` cannot start without slice 2's settings.** `feedServices()` builds `gamesServices()` (which requires `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` and `GAME_ADDRESS_PATTERN`; `src/features/games/services.ts:31-34`) and `playServices()` (`PLAY_PASS_SECRET`). Once branch D merges, the site's front page answers "Something went wrong" if any is missing on the real site. Slice 2 needs G2 and G3 before its own branch E is ready, so they should be set by then. Branch D's report should say the front page now depends on them, and Task 27 step 3 should check `/` first.

**N2. The welcome-back line would sit above the feed.** `src/routes/+layout.svelte` puts `<p role="status" class="panel">Welcome back…</p>` above every page. On a `BARE_ROUTES` screen, it pushes the 100dvh feed down, and it adds a second `status` to the page. Proposed: on `BARE_ROUTES`, leave it out or lay it over the top of the feed. Say which in Task 13.

**N3. "Pip red appears once in the whole site" is true of Ruken's own screens, not of maker pages.** Line 29. One offered combination (measured) holds Scarlet `#cb2f43`. Its page, and its dots, then show the pip colour. Design 5.8 limits the rule to Ruken's own screens. Proposed: reword to "on Ruken's own screens", so no later test runs `pipRed` over a maker's page.

**N4. Space both advances the feed and presses the focused Sound button.** Task 13 (line 615) binds Space. After a tap on Sound, focus is on that button, and Space on a focused button presses it. Proposed: the key handler ignores events whose target is a button or a link. Or leave Space to the browser, which scrolls the snapping scroller by itself.

**N5. Touch laptops get "Swipe up".** `navigator.maxTouchPoints > 0` (line 786) is true on many Windows laptops with a mouse. `matchMedia("(pointer: coarse)")` names the main pointer instead. This is a Call; it is noted, not changed. Task 17 step 3 already reads both.

**N6. Two `showTheOwner` screenshots would both be named "the paywall card".** `CARD_SCREENS` in `tests/browser/support/look.ts:51` already attaches `look: the paywall card`, and Task 19 (line 885) adds another with that name. Proposed: "the paywall card, with its mark".

**N7. Which card is "the price card" for someone signed in.** Line 872 says "the card that shows the price and 'Continue'". A signed-in non-member's card shows the price and "Continue to payment" (`tests/browser/join.test.ts:140-146`). Line 85 reads as the pip being there too. Proposed: say "every card that shows the price", and name `join.test.ts:133-147` as the case whose two `pipRed` lines become one mark each.

**N8. A maker's account id goes to the browser.** `PublicPage` holds `makerUserId` (line 419). If the route returns it from `load`, it is in the page's data. Proposed: the route uses it for `liveGames` and `arrival.remember` and returns only what the component draws.

**N9. The formatter has a name.** Task 20 (line 909) says "export that small formatter from `games.ts`". It is `megabytes`, in `src/features/games/files-check.ts`.

**N10. `purgeDueAccounts` gains a required `files`.** Every caller must pass it: the route, eight calls in `purge.pg.test.ts`, and any that slice 2's branch E adds. Proposed: Task 20 says "every caller (search `purgeDueAccounts(`)".

**N11. `pages.browser.ts` is made two branches before anything imports it.** Tasks 3 and 5 add to it in branches A and B. Its first importer is `src/params/handle.ts` in branch H. CLAUDE.md: "Code stays only if something in the repository uses it." Proposed: create it in Task 22. Slice 1 did build `arrival.remember` ahead of its caller, so this is not a stop.

**N12. Test file names that do not mirror a source file.** `tests/features/pages/colours.test.ts` tests `themes.ts` and `library/colours.json`. `social-icons.test.ts` tests `library/social-icons.json`. Proposed: `tests/features/pages/library/colours.test.ts` and `…/library/social-icons.test.ts`, which mirror the data files.

**N13. How `themes.ts` imports its JSON.** It is bundled for the browser, read by Vitest, and imported by Playwright journeys (line 1030). Proposed: say the import form (`import colours from "./library/colours.json" with { type: "json" }`), which Vite and Node 24 both accept.

**N14. Slice 2's browser-entry rule must let a feature's own component import its own files.** `Feed.svelte` imports `./share.ts` and `./current.ts`. Slice 2's rule reads "a `.svelte` file … reach[es] a feature only through its `.browser.ts` entry". If it is written without a same-feature exemption, Task 13 fails at once. Task 13's own new case has the exemption ("from outside its feature", line 619). Proposed: Task 13 checks the merged rule and says which case it is.

**N15. A PNG with clear parts turns black.** `canvas.toBlob(…, "image/jpeg")` (line 1185) fills transparency with black. Proposed: fill the canvas with white before drawing.

**N16. The address field's "https://".** In Task 26's sketch (line 1233), if "https://" is the field's value rather than its placeholder, a pasted address becomes `https://https://…`. Proposed: say it is the placeholder.

**N17. `savePage`'s unique error.** Line 414 maps Prisma's `P2002` to `TAKEN`. Two saves by one person at once hit the unique `userId` instead, and would read "That one is taken". Proposed: check `meta.target` names `handle`.

**N18. Round icon buttons and the 12px rule.** Share, the account mark, Sound's mark and the social marks are 48px round targets. Design 5.8's 12px is for buttons with words, and the feed is not a Card Table screen, so nothing is wrong. Proposed: name it in the look's Calls, so the Owner sees it in the screenshots and is not surprised.

## For the coordinator

- No question for the Owner blocks execution. S4 is answered (Owner, 2026-11-14: "Page's own colours"). S8 is worth the Owner's eye at branch I's screenshots.
- S1, S2, S5, S9, S10 and S11 would each fail in CI or stop a task as the plan is written. They are cheapest fixed in the plan before branches A to D start.
