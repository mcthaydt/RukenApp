# Maker Screens Rebuild (slice 2, branch M) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (CLAUDE.md: no subagents). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the maker's screens on branch `slice-2/submit` (pull request #63) so that sending a game is one question per screen, as the Owner approved, and nothing more than slice 2 needs.

**Architecture:** The games service and its tables stay; a game row now exists from the first answer, with later answers empty until given. Each question is its own address under `/make/<game>/`, a plain page and form that works before its script wakes. The pure rules (which question is next, the counter, the reasons a part can be sent back for, the words) live in the `games` feature and are unit-tested; the screens are thin. The old one-card form and checklist are replaced, not kept beside the new screens.

**Tech Stack:** as slice 2 (SvelteKit 3.0.0, Svelte 5.57.1, Prisma 7.10.0, Postgres 16, Vitest, Playwright 1.63.0 on nine projects, Cloudflare Workers, R2). **No new package.**

**Spec:** `docs/superpowers/specs/2026-11-14-maker-screens-redesign-design.md` (pull request #96; approved by the Owner on 2026-11-15, "Yes"). It amends the main design (`2026-11-13-ruken-reels-linktree-design.md`, sections 5.4, 5.7, 5.8). Read both, with `CLAUDE.md`, the slice 2 plan (`2026-11-13-slice-2-games-play.md`: its Global Constraints and "How a task runs" hold here) and the tracker.

**The board:** `/mnt/project-files/maker-screens/maker-screens-round-7.html` is the source of the last board the Owner saw (version 26). Read the file; never open the board with the Artifact tool. Its stylesheet holds the sizes for each of the five layouts.

**Planned against:** `main` at `3da364c`, `slice-2/submit` at `0387975` (113 commits behind `main`; a trial merge had no conflict), and the spec on `spec/maker-screens-redesign-2` at `0ea2a8c`. No test, lint or typecheck ran in the plan session; no code was written.

## Which words win

The spec was written over two days and later sections overrule earlier ones. Where two parts differ, in this order:

1. A later section beats an earlier one (15, 16 and 17 over 4 and 5).
2. The spec's words beat the board's stylesheet.
3. The board's stylesheet settles a size the spec does not give.

The differences that matter here, already settled by rule 1:

| Earlier | Later, and built |
|---|---|
| 4.1: unpicked choices step down to sage | 15.2: every choice is white; the picked one has a blue edge and a tick |
| 4.4, 4.5: buttons under the answer on a tablet and a sideways phone | 15.2: buttons are pinned to the bottom on a phone, a sideways phone and an upright tablet |
| 4.2, 4.4: the sheet scrolls inside itself | 15.2: no card scrolls inside itself; the page scrolls |
| 4.5: "Finish later" at the bottom right on a sideways phone | 15.2: "Finish later" stays top right |
| 5b: each thing to fix is a red card; "6 accepted" is green | 15.1: a white card with a blue edge and the label "Needs fixing"; red is only for what can't be undone |
| 5b: a small "Edit" on each thing | 15.3: "Change" everywhere |
| 5: Live's green button "Send my newest version for review" | 14.2 and the board: a quiet blue outline, "Send a new version" |
| 3: the game's questions are "of 6" | 10.5: "of 7" with the age rating, "of 8" for an 18+ game |

One place the spec's words beat the board (rule 2): the board draws "Needs fixing" and "What players will see" in capitals; section 4.7 keeps 5.8's "no uppercase labels". They are built in sentence case.

## What is in this plan, and what waits

Owner, 2026-11-15: "I want us to stick to our original plan only building things directly relevant to slice we're currently on". Slice 2 is games and play. This plan builds only the path from "Add a game" to a game that is waiting, sent back or live.

**Built here (branch M):**

| Spec | What |
|---|---|
| 1, 15.1 | The button rule on every screen Ruken has today: the main button blue, a safe one green, the one that deletes red, a second forward action a quiet blue outline |
| 3, 5 | The door on Your account; Your games; the game's questions (name, one line, game files, plays on, upright video, wide video); the agreement; Check and send; Waiting; Sent back; Live; Throw a draft away; changing a name, a line and where it plays |
| 10.1 row 1, 10.5, 12 | "Who is it for?" (3+ to 18+) and, for an 18+ game, "Does it have any of these?". Owner, 2026-11-15: "Yes, ask it now". A game only carries the answers; hiding by age belongs to the apps |
| 4, 15.2, 15.4, 16.2 | The five layouts, the step that moves, tap targets of 44, lining digits, no super-rounded shapes, and "What players will see" beside a question on a computer and a sideways tablet |
| 5a, 5b, 5c | Videos that play and open full size; a still on each game in Your games; the game laid out on Check and send; Sent back led by what to fix; Live as the statement piece |
| 15.1, 15.3 | "GitHub only, with help": the how-to page, the plain index.html message, the video hint |
| 11.2 (the data only) | A game is sent back part by part, each with a reason from a short list. Branch M builds the rule and the maker's side; the staff screen that ticks the parts is Task 30, on branch S |

**Not built here, and where it belongs:**

| Spec | What | Where |
|---|---|---|
| 6, 13.1 M4 to M8, 16.3 | The first-game questions about the maker's page (address, photo, about you, colours), Your page, its rooms, its song | Slice 3, after "Your page" gets its own design (Owner's order: submission, then Your page, then reels) |
| 15.4 | The maker's handle in "What players will see" | Slice 3: a maker has no address until then, so the preview shows the clip, name, line and rating only |
| 10.1 rows 2 to 11, 10.2 to 10.4, 13.1 M9 to M20, 16.2, 17 | Extras, who shares the money, Your money, statements, taxes, the bank, beta, achievements, events, Players, Reviews, reporting, Connect your game, earner rankings | The sales, beta and apps plans, and slice 5 (money) |
| 10.3 | The list of rooms on a live game | With the first room that exists. Until then Live shows the game laid out, as section 5c drew it |
| 11, 13.2, 14.1 | The staff screens | Pinned by the Owner until after submissions, pages and reels. Slice 2 builds only Accept and Send back (Task 30, amended below) |
| 13.1 M1, M2 | A maker takes a game off Ruken and puts it back | Task 31 on branch S, amended below. The refund lines come with sales |
| 13.1 M3 | Taken down by staff | Slice 4 |
| 13.1 M11 | "Our maker agreement changed" | With the agreement's version 2, in the sales plan |
| 12.0a, 13.1 M19, 15.4 | The Store version; scores and leaderboards | After launch |
| 4, 5 (last line) | The new layout on sign-in and the account screens | Those screens are being redrawn text-first under pull request #113. Here they change only their buttons' colours |

## What follows in slice 2

Checked live on 2026-11-15: open pull requests are #63 (this branch), #96 (the spec, merging), #104 (legal, held), #111 (apps A, paused), #113 (texts, awaiting "approved"). Branches A to E, P and S0 are merged; Task 19 is merged (#78).

1. **M**, this plan, on #63. Then its implementation audit, the screen review, and the Owner's "fine".
2. **S**, Tasks 30 and 31, on a new branch from `main` once M is merged. The coordinator's brief named M, F, G; S sits between M and F because F's journeys get their live game through Task 30's Accept. Both tasks are amended at the end of this plan.
3. **F**, Tasks 20 to 23, as the slice 2 plan has them.
4. **G**, Task 24, cut down. The Owner moved the real domain to launch (relayed by the coordinator, 2026-11-15, from the Owner's decision card), so slice 2 keeps only the GitHub App hookup (G2): a maker connects GitHub and sends a game on the test site, with the real GitHub. Nothing in slice 2 waits for a domain or a date. The games domain and the gate's route (G3), and with them playing a game at its real address, move to launch. The test site is a test site: no plan, tracker or message calls this step live.
5. The slice 2 implementation audit, then its fixes.

**Pull request #63 is kept.** The spec says the redesign "is built on branch `slice-2/submit` and lands as part of pull request #63", and the Owner's hold is on that pull request. Its service, tables and tests carry over, so closing it would only make a second branch with the same history. It is larger than one sitting's review (CLAUDE.md, Pace); the implementation audit reads it task by task, each a red commit and a green one.

## Global Constraints

- Everything in the slice 2 plan's Global Constraints, except its "Nothing in this slice is pip red" and its list of look classes, which this plan replaces.
- No session runs tests, lint or typecheck. Push, read CI on #63. Each task is two pushes, red then green (slice 1 plan, "How a task runs"). `prettier --write` on the files a session wrote is allowed, nothing else.
- Nine browser projects run every journey (five Chromium, four WebKit). A journey waits on readiness, never on a sleep; after a form post it waits with `pageHasSettled` (`tests/browser/support/account.ts`).
- `.github/workflows/ci.yml` does not change.
- No new dependency. No new colour: every colour in `look.css` is one of the ten tokens. No `<style>` block, `style=` attribute or colour under `src/routes/`.
- Colours: blue (`--pay`) is the one main button on a screen; green (`--felt-raised`) is "nothing changes" (Back, Keep it); red (`--pip`) is only "can't be undone" (Throw it away, Delete my account); a second forward action is a quiet blue outline. No shape is rounder than 12px except a person's photo.
- Words: the words in this plan and the spec are the words to ship. "Choose", never "Tap". "Change", never "Edit". A change to any of them is a deviation to report.
- Every text link, tick, choice and button is at least 44 by 44 CSS pixels.
- Nobody types a fact: sizes, counts and dates are measured or read from a file.
- Comments say why, never which plan or finding asked.
- This repository is public: nothing private goes in.
- Stop and report, rather than work around: a failing test that is not the task's own red, the third fix for the same failure, a task at twice its expected time.

## Review Focus

What a person will meet that the spec does not spell out. Each has its test in the task named.

1. **A later question's address opened too early** (a bookmark, a second tab): it answers with a redirect to the first question not yet answered, never a broken screen. Task 4.
2. **Another maker's game**, at every new address and every action: a 404 that says nothing. Task 4, and each later task adds its addresses to the same test.
3. **A new name for a game.** Before a game was ever live its address follows its name, and the old address is gone; once live the address never changes. A name whose address is taken gets `-2`. Tasks 3 and 8.
4. **Sent back for two things, one fixed**: "Send it again" is not on the screen, and a send posted by hand is refused. Tasks 3 and 8.
5. **An 18+ game made 12+**: its marks are cleared and the counter goes back to 7. Tasks 2 and 4.
6. **A name of 60 letters with no space**, on the smallest phone: it wraps, nothing scrolls sideways, the buttons stay in view. Task 4.
7. **GitHub sends her back to a game that is not hers**, or with a state someone changed: Your games with "GitHub didn't connect. Try again.", never another maker's question. Task 5.
8. **Throwing away a game whose files are in the bucket**: the files and both videos are gone, the game is in no list, and its name can be used again. Throwing away a waiting or live game is refused. Tasks 3 and 9.

## File map

```
prisma/schema/games.prisma                      Task 2: answers that may be empty, the rating, the marks, parts sent back
prisma/migrations/20261115100000_questions/     Task 2
src/features/games/
  questions.ts                                  Task 2: the order of the questions, the counter, what is next
  send-back.ts                                  Task 2: the reasons a part can be sent back for, and the maker's words
  library/send-back-reasons.json                Task 2
  review.ts                                     Task 2: the words of a game's state (changed)
  fields.ts                                     Task 3: one checker per answer (changed)
  service.ts                                    Task 3
  services.ts                                   Task 3: media(key); Task 5: the state names a game
  github-connect.ts                             Task 5
  games.ts                                      the entry: every task re-exports what its routes use
src/features/make/library/maker-agreement-v1.txt  Task 7: the date in its title line
src/lib/files/store.ts, r2-store.ts             Task 3: deleteAll
src/lib/look.css                                Tasks 1, 4 to 10
src/lib/quiet-video.ts                          Task 6: a video plays only where motion is welcome
src/params/question.ts                          Task 4
src/routes/me/+page.svelte, me/delete/, join/   Task 1
src/routes/make/
  +layout.svelte                                Task 4: the step that moves
  +page.server.ts, +page.svelte                 Task 4: Your games; Task 9: "was thrown away"
  new/                                          Task 4: question 1 for a game that does not exist yet
  parts/QuestionScreen.svelte                   Task 4
  parts/Picks.svelte                            Task 4
  parts/StateScreen.svelte                      Task 4, filled in Task 8
  parts/VideoTile.svelte                        Task 6
  parts/GameLaidOut.svelte                      Task 7
  parts/GamePreview.svelte                      Task 10
  [game]/+page.server.ts, +page.svelte          Task 4, Task 8
  [game]/[question=question]/                   Tasks 4, 5, 6, 7
  [game]/agreement/, [game]/check/              Task 7
  [game]/throw-away/                            Task 9
  github/, github/callback/                     Task 5
src/routes/help/github/                         Task 5
tests/features/games/questions.test.ts, send-back.test.ts            Task 2
tests/features/games/schema.pg.test.ts, review.test.ts               Task 2 (changed)
tests/features/games/service.pg.test.ts, review.pg.test.ts           Task 3 (changed)
tests/lib/files/store.test.ts                                        Task 3
tests/lib/look.test.ts                                               Tasks 1, 4
tests/browser/buttons.test.ts                                        Task 1
tests/browser/make-questions.test.ts                                 Tasks 4, 5, 6
tests/browser/make-send.test.ts                                      Task 7
tests/browser/make-after.test.ts                                     Tasks 8, 9
tests/browser/make-look.test.ts                                      Tasks 4 to 10
tests/browser/support/game.ts, database.ts, look.ts                  Tasks 4 to 8
```

Removed as they are replaced: `src/routes/make/new/+page.svelte`'s form (Task 4), `src/routes/make/[game]/ClipPicker.svelte` (Task 6), `tests/browser/make.test.ts` (Task 4, see "The old journeys").

---

### Task 0: Bring the branch up to date

No test cycle of its own.

- [ ] **Step 1:** On `slice-2/submit`, `git merge origin/main` (never a rebase). Push. Read CI on #63.
- [ ] **Step 2:** Expected: `verify` and `postgres` pass. The old `tests/browser/make.test.ts` has never run on the WebKit projects, so `browser` may fail there. If every failure is in `make.test.ts` on a WebKit project, send the coordinator the list in one message and go on: Task 4 replaces that file. Any other failure is a stop.

### Task 1: The button rule, on every screen Ruken has today

Spec section 1 and 15.1. The smallest change that makes the site consistent, and the base the new screens stand on.

**Files:**
- Modify: `src/lib/look.css`, `src/routes/me/+page.svelte`, `src/routes/me/delete/+page.svelte`, `src/routes/join/+page.svelte`
- Test: `tests/lib/look.test.ts`, `tests/browser/buttons.test.ts` (new), `tests/browser/look.test.ts`, `tests/browser/support/look.ts`

**Interfaces, produced:** look classes on a `<button>` or `a.button`: none = the main button (blue); `safe` = green; `danger` = red; `outline` = quiet blue outline; `quiet` = a link, as today. The class `pay` is removed: the default is now what it was.

- A main button: `background: var(--pay)`, white words, on felt and on paper alike. `safe`: `var(--felt-raised)`, white words. `danger`: `var(--pip)`, white words. `outline`: no fill, a 2px inset edge; on felt the edge and words are `--chalk`, on paper `--pay`. The board draws the edge on felt in a lighter blue that is not a token, so chalk is used; say so in the tracker for the Owner's look.
- `/me/delete`: "Delete my account" is `danger`, "Keep my account" is `safe`, and there is no main button. Focus starts on "Keep my account".
- `/me` gains one line above "Delete my account": `Make games? <a href="/make">Add yours to Ruken.</a>`
- Digits in headings: add `@font-face { font-family: "Ruken Digits"; src: <the Schibsted Grotesk file already in static/fonts>; unicode-range: U+30-39; }` and put `"Ruken Digits"` first in `--font-display`, so "1" never reads as "I" (15.2).

- [ ] **Step 1 (red):** `look.test.ts`: `--font-display` starts `"Ruken Digits", "Young Serif"`; the `@font-face` for Ruken Digits names a file under `/fonts/` and `U+30-39`; `CLASSES` gains `safe`, `danger`, `outline` and loses `pay`; replace "the paid button is used once" with "no screen uses the class pay". `buttons.test.ts`:

```ts
for (const screen of CARD_SCREENS) {
  test(`${screen.name}: its one main button is blue with white words`, async ({ page }) => {
    await screen.open(page);
    const main = filledButtons(page);            // support/look.ts: buttons that are not safe, danger, outline or quiet
    expect(await main.count()).toBeLessThanOrEqual(1);
    if ((await main.count()) === 1) {
      await expect(main).toHaveCSS("background-color", rgb(token("--pay")));
      await expect(main).toHaveCSS("color", rgb(token("--chalk")));
    }
  });
}
test("deleting an account: green keeps, red deletes, and nothing is blue", async ({ page }) => {
  await signUp(page); await page.goto("/me/delete");
  await expect(page.getByRole("link", { name: "Keep my account" })).toHaveCSS("background-color", rgb(token("--felt-raised")));
  await expect(page.getByRole("button", { name: "Delete my account" })).toHaveCSS("background-color", rgb(token("--pip")));
  await expect(filledButtons(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Keep my account" })).toBeFocused();
});
test("Your account has a door to the maker's area", async ({ page }) => {
  await signUp(page); await page.goto("/me");
  await page.getByRole("link", { name: "Add yours to Ruken." }).click();
  await expect(page).toHaveURL("/make");
});
```

  In `look.test.ts` (browser), "the main button on a card is ink" becomes "is blue", and the card screens' "no red" case lets the delete screen have its one red button and no other. Push. Expected: `verify` fails in `tests/lib/look.test.ts` only; `browser` fails in `buttons.test.ts` and the two changed look cases only.
- [ ] **Step 2 (green):** the stylesheet and the three screens. Push. Expected: all pass.

### Task 2: A game that is half answered, and the rules around it

**Files:**
- Create: `prisma/migrations/20261115100000_questions/migration.sql`, `src/features/games/questions.ts`, `src/features/games/send-back.ts`, `src/features/games/library/send-back-reasons.json`
- Modify: `prisma/schema/games.prisma`, `src/features/games/review.ts`
- Test: `tests/features/games/questions.test.ts`, `tests/features/games/send-back.test.ts`, `tests/features/games/review.test.ts`, `tests/features/games/schema.pg.test.ts`

**The tables.** Where a half-answered game is kept (spec section 8): in its own `Game` row, a `draft`, from the first Next.

- `Game.oneLine`, `Game.playsOn`, `Game.repoFullName` become nullable.
- New enums: `AgeRating { age_3 age_7 age_12 age_16 age_18 }`; `ContentMark { sex_or_nudity gore drugs none }` (`none` is the answer "None of these", so an empty list means not answered); `GamePart { name one_line files plays_on upright_video wide_video age_rating other_websites }`.
- `Game.ageRating AgeRating?`; `Game.contentMarks ContentMark[] @default([])`; `Game.toFix GamePart[] @default([])` (the parts staff sent back that the maker has not changed yet).
- `GameState` gains `thrown_away`.
- `GameReview.reason` and `GameReview_reason_check` are dropped. New `GameReviewPart { id, reviewId, part GamePart, reason String, note String?, createdAt }`, unique on `(reviewId, part)`, added and never changed (`reject_append_only_change('GameReviewPart')`). `Game.stateReason` stays for slice 4's "Taken down"; nothing writes it in this slice, and its comment says so.
- Hand-written rules at the end of the migration:
  - `Game_answered_check`: a game past `draft` has every answer. `"state" NOT IN ('waiting','live','sent_back','taken_off','taken_down') OR ("oneLine" IS NOT NULL AND "playsOn" IS NOT NULL AND "repoFullName" IS NOT NULL AND "ageRating" IS NOT NULL AND ("ageRating" <> 'age_18' OR cardinality("contentMarks") > 0))`. It is written with the old state names on purpose: Postgres refuses to use an enum value in the transaction that adds it.
  - `Game_marks_check`: marks only on an 18+ game, and `none` stands alone. `(cardinality("contentMarks") = 0 OR "ageRating" = 'age_18') AND (NOT ('none' = ANY("contentMarks")) OR cardinality("contentMarks") = 1)`.
  - `GameReviewPart_note_check`: `("note" IS NULL OR char_length("note") BETWEEN 1 AND 500) AND ("reason" <> 'something_else' OR "note" IS NOT NULL)`.
- If CI shows Postgres refusing the migration over the new enum values, put `ALTER TYPE "GameState" ADD VALUE` in a migration of its own just before this one, and report the deviation.

**Interfaces, produced.**

`questions.ts`:

```ts
export const QUESTIONS = ["name", "line", "files", "plays-on", "upright", "wide", "age", "marks"] as const;
export type QuestionId = (typeof QUESTIONS)[number];
/** A question that is only ever changed from Check and send, so it has no place in the count. */
export type ChangeOnlyId = "websites";
export interface Answers {
  oneLine: string | null; hasFiles: boolean; playsOn: GamePlaysOn | null;
  upright: boolean; wide: boolean; ageRating: AgeRating | null; contentMarks: ContentMark[];
}
/** The questions this game is asked, in order: seven, or eight with "marks" for an 18+ game. */
export function questionsFor(answers: Pick<Answers, "ageRating">): QuestionId[];
export function isAnswered(question: QuestionId, answers: Answers): boolean;   // "name" is always true
export function firstUnanswered(answers: Answers): QuestionId | null;
export function counterOf(question: QuestionId, answers: Answers): { n: number; of: number };
export function questionBefore(question: QuestionId, answers: Answers): QuestionId | null;
export function partOf(question: QuestionId | ChangeOnlyId): GamePart;          // "marks" and "age" are both age_rating
export function questionOf(part: GamePart): QuestionId | ChangeOnlyId;          // age_rating opens "age"
```

`hasFiles` is true when the game has a pull and its last pull was not refused.

`send-back.ts`, over `library/send-back-reasons.json`:

```ts
export interface SendBackReason { part: GamePart; code: string; staff: string; maker: string }
export function reasonsFor(part: GamePart): SendBackReason[];            // always ends with something_else
export function isReasonFor(part: GamePart, code: string): boolean;
/** What the maker reads on the card: the reason's own words with {name} filled in; for something_else, the note. */
export function makerWords(part: GamePart, code: string, note: string | null, gameName: string): string;
export function partTitle(part: GamePart, gameName: string): string;    // "Name: Floor Fifty", "Upright video"
export function partNoun(part: GamePart): string;                       // "the name", "the upright video": "Fix the name"
```

The reasons (spec 11.2: "The plan writes the full lists"). Every part also has `something_else` ("Something else"), which needs staff's own line and shows that line to the maker.

| Part | Code | Staff choose | The maker reads |
|---|---|---|---|
| name | `rude` | It's rude. | We can't show this name on Ruken. It's rude. Pick another. |
| name | `not_this_game` | It's not this game's. | This name belongs to a different game. Pick your own. |
| one_line | `rude` | It's rude. | We can't show this line on Ruken. It's rude. Write another. |
| one_line | `not_this_game` | It's not this game's. | This line isn't about your game. Say what {name} is. |
| files | `wont_start` | It doesn't start. | Your game didn't start for us. Fix it on GitHub, then send it again. |
| files | `breaks` | It stops working. | Your game stopped working while we played. Fix it on GitHub, then send it again. |
| files | `past_limit` | It goes past what we allow. | Ruken doesn't take games like this yet. |
| files | `pornography` | It's pornography. | Ruken doesn't take pornography. |
| files | `gambling` | Gambling isn't allowed on Ruken. | Gambling isn't allowed on Ruken. |
| plays_on | `needs_keyboard` | It needs a keyboard. | Your game needs a keyboard, so it can't play on phones. Choose Computers only. |
| upright_video, wide_video | `sideways` | It's sideways. | It's sideways. Turn it the right way up. |
| upright_video, wide_video | `not_this_game` | It's not from this game. | It shows a different game. Add a video of {name}. |
| upright_video, wide_video | `too_dark` | It's too dark to see. | It's too dark to see. Record it again, brighter. |
| age_rating | `wrong_age` | The age is wrong. | We think {name} is for older players. Choose again. |
| other_websites | `not_listed` | It uses a website it didn't list. | Your game uses a website that isn't on your list. Add it. |

Call, to be checked at the audit: the spec puts "It goes past what we allow." on the age rating row; here the three reasons about what is in the game sit on the game's files, because the only fix is to change the game on GitHub and that is where "Fix this" must lead. `partTitle`: "Name: {name}", "One line", "Game files", "Where it plays", "Upright video", "Wide video", "Who it's for", "Other websites". `partNoun`: "the name", "the line", "your game's files", "where it plays", "the upright video", "the wide video", "who it's for", "the websites".

`review.ts`, changed:

```ts
/** The line on a game's card in Your games. */
export function listWords(game: { state: GameState; hasPending: boolean; toFix: number; firstUnanswered: QuestionId | null; questionNumber: number | null }): string;
/** How many things to fix, as the Sent back screen says it; null when nothing is left. */
export function toFixWords(count: number): string | null;   // "One thing to fix. Then send it again." / "2 things to fix. Then send it again."
```

`listWords`: a draft with a question left, "Not finished. Go on from question 3."; a draft with none left, "Ready to send."; "Waiting for review"; "Sent back. See what to fix."; "Live"; "Live. Your update is waiting for review"; "Live. Your update was sent back. See what to fix."; "Off Ruken. You took it off."; "Taken down. See why.". `stateParts` keeps its headlines without the reason; `beforeSendWords`, `MissingBeforeSend` and `stateWords` are removed with their tests (nothing is refused in a list any more). `nextStepWords` keeps only the lines the new screens show: "We're looking at it. Come back here to see when it's live.", "Players can find it on Ruken.", "Your update is waiting for review.".

- [ ] **Step 1 (red):** `questions.test.ts`:

```ts
const none: Answers = { oneLine: null, hasFiles: false, playsOn: null, upright: false, wide: false, ageRating: null, contentMarks: [] };
it("a new game goes on from its one line", () => expect(firstUnanswered(none)).toBe("line"));
it("asks seven questions, and an eighth of an 18+ game", () => {
  expect(questionsFor({ ageRating: "age_12" })).toHaveLength(7);
  expect(questionsFor({ ageRating: "age_18" }).at(-1)).toBe("marks");
});
it("counts the age question as 7 of 7, and the marks as 8 of 8", () => {
  expect(counterOf("age", none)).toEqual({ n: 7, of: 7 });
  expect(counterOf("marks", { ...none, ageRating: "age_18" })).toEqual({ n: 8, of: 8 });
});
it("an 18+ game is not done until its marks are answered", () => {
  const all = { oneLine: "x", hasFiles: true, playsOn: "computer_only", upright: true, wide: true } as const;
  expect(firstUnanswered({ ...all, ageRating: "age_18", contentMarks: [] })).toBe("marks");
  expect(firstUnanswered({ ...all, ageRating: "age_18", contentMarks: ["none"] })).toBeNull();
  expect(firstUnanswered({ ...all, ageRating: "age_12", contentMarks: [] })).toBeNull();
});
it("goes back one question, and from the first nowhere", () => {
  expect(questionBefore("files", none)).toBe("line");
  expect(questionBefore("name", none)).toBeNull();
});
it("every part opens a question, and that question names the part", () => {
  for (const part of ALL_PARTS) expect(partOf(questionOf(part))).toBe(part);
});
```

  `send-back.test.ts`: every part's list ends with `something_else`; every code in the table above is in its part's list with those exact words; `isReasonFor("name", "sideways")` is false; `makerWords("upright_video", "not_this_game", null, "Floor Fifty")` is "It shows a different game. Add a video of Floor Fifty."; `makerWords("name", "something_else", "Too close to another game's name.", "x")` is the note; no maker's words are longer than 90 characters. `review.test.ts`: one case for each line of `listWords` and both of `toFixWords`. `schema.pg.test.ts`: a draft with no line, no place to play and no repository is kept; the same row as `waiting` is refused by `Game_answered_check`; an 18+ `waiting` game with no marks is refused; marks on a 12+ game and `none` beside `gore` are refused by `Game_marks_check`; a `GameReviewPart` cannot be updated or deleted; `something_else` with no note is refused. Stubs for the new exports. Push. Expected: `verify` fails in the three unit files only; `postgres` fails in `schema.pg.test.ts` and in the migrations drift check.
- [ ] **Step 2 (green):** the schema, the migration, the three files. Push. Expected: all pass. `service.pg.test.ts` and `review.pg.test.ts` still pass or fail only on what Task 3 changes; if they fail here, fold Task 3's Step 1 into this push and report it.

### Task 3: The games service, one answer at a time

**Files:**
- Modify: `src/features/games/service.ts`, `fields.ts`, `services.ts`, `games.ts`, `src/lib/files/store.ts`, `src/lib/files/r2-store.ts`, `tests/support/memory-file-store.ts`
- Test: `tests/features/games/service.pg.test.ts`, `tests/features/games/review.pg.test.ts`, `tests/features/games/fields.test.ts`, `tests/lib/files/store.test.ts`

**Interfaces, consumed:** Task 2's `questions.ts`, `send-back.ts`, `review.ts`.

**Interfaces, produced** (on the games service unless said):

```ts
startGame(input: { makerUserId: string; name: string }): Promise<{ id: string; slug: string }>;      // replaces createGame
type Answer =
  | { question: "name"; name: string }
  | { question: "line"; oneLine: string }
  | { question: "files"; repo: { fullName: string; branch: string | null; folder: string } }
  | { question: "plays-on"; playsOn: GamePlaysOn }
  | { question: "age"; ageRating: AgeRating }
  | { question: "marks"; contentMarks: ContentMark[] }
  | { question: "websites"; connectHosts: string[] };
/** Keeps one answer. Answers the game's address, which a new name may have changed. */
saveAnswer(gameId: string, makerUserId: string, answer: Answer): Promise<{ slug: string }>;
sendForReview(gameId: string, makerUserId: string): Promise<void>;                                    // two more refusals
sendBack(gameId: string, staffUserId: string, parts: { part: GamePart; reason: string; note?: string }[]): Promise<void>;
throwAway(gameId: string, makerUserId: string): Promise<{ name: string }>;
// FileStore:
deleteAll(prefix: string): Promise<number>;
// GamesServices:
media(key: string): string;      // the address of a clip: address("media") + "/" + key
```

- `fields.ts` exports one checker per answer (`nameProblem`, `oneLineProblem`, and the repository, branch and folder checks it has), each answering the refusal's words or undefined; `gameFieldProblems` is removed. New refusals: "Choose where your game plays.", "Choose who your game is for.", "Choose at least one, or None of these.". The rest are today's words.
- `startGame` checks the name and makes a `draft` with only its name, id and address.
- `saveAnswer` finds the game among the maker's own (else `NOT_FOUND`, "We can't find that game."). By state: `draft`, `waiting` and `sent_back` take every answer; `live` takes `name`, `line` and `plays-on`; anything else is `NOT_READY`, "That can't be changed right now.".
  - `name`: while no review of the game was ever `accepted`, the address is made again from the new name (`freeSlug`); after that it never changes.
  - `files`: `checkReachable`, keep the repository, branch and folder, then `pullLatest`. A refused pull throws `FILES_REFUSED` with the choice kept, so the screen that asked shows it.
  - `websites`: keep the list, then `pullLatest`, because a pull records the list staff will review.
  - `age`: a rating other than `age_18` clears the marks. `marks`: refused unless the game is `age_18`; `none` clears the others.
  - Every kept answer takes its part out of `toFix` (`files` only when the pull passed).
- `saveClip` also takes its part out of `toFix`.
- `sendForReview` also refuses: an answer still missing, "Answer every question first."; something still in `toFix`, "Fix what was sent back first.".
- `sendBack`: at least one part, "Tick what's wrong first."; no part twice; each reason one of that part's, else "Pick a reason for each part you ticked."; `something_else` with no line, "Say what's wrong in your own words.". In one transaction: the game's state as today, `toFix` set to the parts, one `GameReview` row and one `GameReviewPart` row for each part.
- `accept` also empties `toFix`.
- `throwAway`: the maker's own game in `draft` or `sent_back`, else `NOT_READY`, "This game can't be thrown away.". The database first, in one transaction: state `thrown_away`, the address changed to `x-<publicId>` so the name is free again, `pendingPullId`, `pendingSince` and `toFix` emptied, the `GameClip` rows deleted. Then `deleteAll("files/<publicId>/")` and `deleteAll("clips/<publicId>/")`. A thrown-away game is in no list, and `gameForMaker` answers null for it.
- `deleteAll`: deletes every object whose key starts with `prefix` and answers how many; a prefix that does not end in `/` throws, so `files/abc` never also takes `files/abcd`. `r2FileStore` lists a page at a time and deletes each page's keys in one call.
- `MakerGame` gains `oneLine`, `playsOn`, `ageRating`, `contentMarks`, `everLive`, `clips: { upright: { key: string; bytes: number } | null; wide: … }`, and `toFix: { part: GamePart; title: string; words: string; note: string | null }[]` from the newest sent-back review, only for parts still in `Game.toFix`. `MakerGameRow` gains `wideClipKey: string | null` and takes its words from the new `listWords`.
- `waitingGames`, `gameForReview` and `liveGameBySlug` keep their shapes; `liveGameBySlug` also answers `ageRating` and `contentMarks`.

- [ ] **Step 1 (red):** `store.test.ts`: `deleteAll("files/a/")` removes `files/a/x` and `files/a/y/z`, keeps `files/ab/x`, answers 2; `deleteAll("files/a")` throws. `fields.test.ts`: one case for each checker's refusal. `service.pg.test.ts` and `review.pg.test.ts`, new and changed cases:
  - `startGame("Floor Fifty")` makes a draft at `floor-fifty` with no line, no repository and no rating; a second is `floor-fifty-2`; a two-letter name is refused with today's words.
  - Each answer is kept; another maker's game is `NOT_FOUND` for every one.
  - A draft renamed "Tower" moves to `tower`; a game that was accepted once keeps its address under a new name (Review Focus 3).
  - `files` with the broken repository throws `FILES_REFUSED` and still keeps the repository; with the good one, the game has a pull.
  - 18+ with `gore`, then 12+: the marks are empty (Review Focus 5). `marks` on a 12+ game is refused. `none` with `gore` keeps only `none`.
  - A live game refuses `age` and takes `line`.
  - `sendForReview` with the age missing: "Answer every question first.".
  - `sendBack` with the name (`rude`) and the upright video (`sideways`): the game is `sent_back`, `toFix` holds both, two part rows are written, and `gameForMaker(...).toFix` reads "We can't show this name on Ruken. It's rude. Pick another." and "It's sideways. Turn it the right way up.". `sendBack` with `("name", "sideways")`, with no parts, with a part twice, and with `something_else` and no line are each refused in their words.
  - After that, `saveAnswer(name)` leaves one thing to fix and `sendForReview` is refused, "Fix what was sent back first."; `saveClip(upright)` empties `toFix` and the send goes through (Review Focus 4).
  - `throwAway` of a sent-back game with a pull and two clips: no key is left under `files/<publicId>/` or `clips/<publicId>/`, `gamesOf` no longer lists it, `gameForMaker` is null, `startGame` with the same name gets the plain address again; `throwAway` of a waiting game and of a live game is refused (Review Focus 8).
  
  Stubs. Push. Expected: `verify` fails in `store.test.ts` and `fields.test.ts`; `postgres` in the two pg files; `browser` fails wherever the old form calls `createGame`. That last red is expected and is cleared in Task 4; to keep the routes compiling, the old `/make/new` action calls `startGame` then `saveAnswer` for each field until Task 4 replaces it.
- [ ] **Step 2 (green):** the code. Push. Expected: `verify` and `postgres` pass. `browser`: the old journeys pass through the bridged form; if any fail only because a draft now lacks an age rating at send, go straight on to Task 4 and say so in the task's line to the coordinator.

### Task 4: The question screen, the easy questions, and Your games

Spec sections 3, 4, 10.1 row 1, 12, 15.2.

**Files:**
- Create: `src/params/question.ts`, `src/routes/make/+layout.svelte`, `src/routes/make/parts/QuestionScreen.svelte`, `parts/Picks.svelte`, `parts/StateScreen.svelte`, `src/routes/make/[game]/[question=question]/+page.server.ts`, `+page.svelte`
- Modify: `src/lib/look.css`, `src/routes/make/+page.svelte`, `+page.server.ts`, `src/routes/make/new/+page.server.ts`, `+page.svelte`, `src/routes/make/[game]/+page.server.ts`, `+page.svelte`, `tests/browser/support/game.ts`, `support/database.ts`, `support/look.ts`
- Delete: `tests/browser/make.test.ts`
- Test: `tests/lib/look.test.ts`, `tests/browser/make-questions.test.ts`, `tests/browser/make-look.test.ts`

**Addresses** (spec section 8, "The address of each question"):

| Address | What |
|---|---|
| `/make` | Your games |
| `/make/new` | "What's your game called?" for a game that does not exist yet. Its Next makes the game and goes to `/make/<game>/line` |
| `/make/<game>` | A draft: a redirect to its first unanswered question, or to `check` when none is left. Any other state: that state's screen |
| `/make/<game>/<question>` | One question: `name`, `line`, `files`, `plays-on`, `upright`, `wide`, `age`, `marks`, and `websites` |

`src/params/question.ts` matches exactly those nine words. A question after the first unanswered one redirects to that one (Review Focus 1). `marks` for a game that is not 18+ is a 404.

**How a question behaves.**

- First time through (an answer is still missing): the blue button is "Next"; it saves and goes to the next question, then to `agreement` or `check` (Task 7). "Back" is a green link to the question before; on `/make/new` it goes to Your games.
- Changing (every answer is in, or the game is waiting, sent back or live): the blue button is "Save"; it saves and goes to `/make/<game>`. "Back" goes there too. The counter and the track are not shown.
- The top bar: "Ruken" on the left; on the right "Finish later", a link to `/make`.
- Every action finds the game among the signed-in maker's own (Review Focus 2).
- A refusal comes back with what she typed, under the hint, with the box marked `aria-invalid` and in focus.
- A button that takes time says so and cannot be pressed twice.

**The questions built in this task.** `{name}` is the name she typed.

| Question | Heading | Answer | Hint |
|---|---|---|---|
| `name` | What's your game called? | one box | The name players see. Like: Floor Fifty. When changing a live game's name, also: Its address on Ruken stays the same, so links you've shared keep working. |
| `line` | What's {name} about, in one line? | one box | Players see it under the name. Like: Climb. Fall. Climb again. |
| `plays-on` | Where does {name} play? | two choices: "Phones and computers" / "Computers only", the second with the line "Choose this if your game needs a keyboard or a mouse." | none |
| `age` | Who is {name} for? | five choices: "3+" Fine for anyone. / "7+" Cartoon fighting, or a little scary. / "12+" Real-looking fighting, or scary bits. / "16+" More violence or strong words. / "18+" Only for adults. | We check this when we look at your game. |
| `marks` | Does {name} have any of these? | pick several: "Sex or nudity", "Gore", "Drugs", "None of these" | Only adults see it. Pornography and gambling are never allowed. |

Nothing is picked for her on any choice. On `marks`, choosing "None of these" unticks the others, and choosing another unticks it; without script the server does the same.

**Your games.** The heading and a blue "Add a game" (a link to `/make/new`); top right, a link "Your account". Each game is one paper card and the whole card is a link: a still on the left (96 by 54 on a phone, 128 by 72 otherwise; a plain sage block until Task 6 gives it the video), the name in Young Serif at 32px, and its `listWords` line. With no game: "You haven't added a game yet." and "You'll need your game on GitHub, ready to run in a browser, and two short videos of it."

**`/make/<game>` for a game that is not a draft**: `StateScreen.svelte`: the name, the state's headline as the heading, its `nextStepWords` line, and a link "Back to your games". For a waiting game that link is the blue button (spec section 1) and the screen is final here; Task 8 fills in Sent back and Live.

**The look.** New classes in `look.css`, each named in `CLASSES` (`tests/lib/look.test.ts`): `screen` (the whole window as the stage), `track`, `topbar`, `count`, `answer` (the paper box), `picks` and `pick` (the choice cards; today's `choice` class stays as it is for the join screen), `acts` (the buttons), `key` (the Enter hint), `halves` and `sheet` (used from Task 7), `game` (a card in Your games; today's rule is replaced), `foot` (the small link at the bottom). The sizes, from spec section 4 and the board's stylesheet:

| | Phone upright | Phone sideways | Tablet upright | Tablet sideways | Computer |
|---|---|---|---|---|---|
| Media query | `max-width: 499px` | `max-height: 449px` | `min-width: 500px` and portrait | landscape, `min-height: 450px`, `max-width: 1199px` | everything else |
| Heading | 36px | 32px | 64px | 48px | 64px |
| Column | the screen, 20px sides | 600px | 640px | 760px | 760px |
| Answer box | 64px tall | 52px | 72px | 72px | 72px, 24px type, 12px corners, no outline |
| Buttons | 56px, in the bar | 52px, in the bar | 60px, in the bar | 60px, under the answer | 60px tall, the blue one at least 168px wide, under the answer |
| Choices | stacked | two across | two across (ratings in one row) | two across (ratings in one row) | two across (ratings in one row) |

- The bar: fixed to the bottom, `--felt-deep`, clear of the home indicator (`env(safe-area-inset-bottom)`); Back on the left, the blue button filling the rest. The page has room under its last line so the bar never covers it.
- The column is centred across; on a tablet sideways and a computer it is centred down too, and on the others the question starts under the top bar.
- The counter: "Question 2 of 7", body size, sage, over the heading. The track: along the very top, one piece per question, 6px tall, answered pieces chalk on `--felt-raised`.
- A picked choice: white like the rest, a 4px inset edge in `--pay`, and a tick; pick-one shows a plain blue check, pick-several a square box that fills blue.
- "press Enter ↵", the key drawn, shows only `@media (hover: hover) and (pointer: fine)` on the computer layout, and not beside a button that opens a file picker.
- "Throw this game away" (`foot`, 14px, sage) is at the bottom left; its link is built in Task 9.
- A long word wraps (`overflow-wrap: anywhere`) (Review Focus 6).

**What moves** (spec 4.6). `src/routes/make/+layout.svelte` wraps a move between two questions in `document.startViewTransition` where the browser has it, and sets `data-step="on"` or `"back"` on the page from the two questions' places in `QUESTIONS`. In `look.css`: the old question lifts 12px and fades in 120ms; the new one's lines rise 28px over 460ms, each 40ms after the one before (`animation-delay` from a `--line` number set on each child), with `cubic-bezier(0.32, 0.72, 0, 1)`; going back, the same downward. Only `transform` and `opacity` change. Under `prefers-reduced-motion: reduce` there is no animation at all.

**The journeys' helpers** (`tests/browser/support/game.ts`, rewritten): `answerName(page, name?)`, `answerLine(page)`, `answerPlaysOn(page, "computers" | "both")`, `answerAge(page, "12+")`, `nextButton(page)`, `startDraft(page): Promise<{ slug; name }>` (sign up, `/make/new`, the name). `tests/browser/support/database.ts` gains `fillAnswers(slug, { files?: boolean; videos?: boolean; age?: AgeRating })`, which writes the pull, clip and rating rows straight into the database so a journey about one screen does not have to walk all the others, and keeps `putGameWhereStaffLeaveIt`, now taking `{ state, toFix?: { part; reason; note? }[] }`.

**The old journeys.** `tests/browser/make.test.ts` is deleted in this task's red push. Nothing is dropped silently: each old journey's intent is carried as below, and the tracker records the table when the last one lands.

| Old journeys (line in `make.test.ts`) | Carried to |
|---|---|
| 74, 87 Your games; 422 signed out; 428 the way back | Task 4, `make-questions.test.ts` |
| 207, 220, 269, 284 the form's name and line, their refusals; 375 one game on a double press | Task 4 |
| 121 to 172, 351, 698, 718 GitHub and the files; 328 the folder | Task 5 |
| 476 to 570, 788 the videos and the picker | Task 6 |
| 199, 307, 825 other websites; 582 to 687 sending and the agreement; 862 to 905 the agreement's page | Task 7 |
| 742 sent back; 766 live; 810 another maker | Task 8 (810 also in Task 4) |
| 232 every refusal at once; 404 the fold-outs' chevrons; 446, 843 the checklist and its rows; 600 to 638 sending with things missing | Gone with the screens they tested: one question per screen has one refusal, and Send is reached only with every answer in. Say so in the tracker |

- [ ] **Step 1 (red):** `tests/lib/look.test.ts`: `CLASSES` gains the classes above; no rule under them uses a colour that is not a token; a `prefers-reduced-motion` block sets `animation: none` on `.screen` and its children. `make-questions.test.ts` (each starts with `forgetRateLimits`, each attaches its screen with `showTheOwner`):

```ts
test("Your games, with none, says what a maker needs and has one blue button", async ({ page }, testInfo) => { /* the two lines; Add a game is blue; "Your account" leads to /me */ });
test("a maker answers the name and is asked the next question, with her name in it", async ({ page }) => {
  await signUp(page); await page.goto("/make/new");
  await expect(page.getByText("Question 1 of 7")).toBeVisible();
  await page.getByLabel("What's your game called?").fill("Floor Fifty");
  await nextButton(page).click();
  await expect(page).toHaveURL(/\/make\/floor-fifty(-\d)?\/line$/);
  await expect(page.getByRole("heading", { name: "What's Floor Fifty about, in one line?" })).toBeVisible();
  await expect(page.getByText("Question 2 of 7")).toBeVisible();
});
test("every Next saves: after Finish later the game is in Your games, and goes on where she left", async ({ page }) => {
  const { name } = await startDraft(page);
  await page.getByRole("link", { name: "Finish later" }).click();
  await expect(page.getByRole("link", { name: new RegExp(name) })).toContainText("Not finished. Go on from question 2.");
  await page.getByRole("link", { name: new RegExp(name) }).click();
  await expect(page).toHaveURL(/\/line$/);
});
test("a name with fewer than three letters is refused under the box, and what she typed stays", async ({ page }) => { /* "Pick a name with at least three letters or numbers."; the box is aria-invalid and focused; value kept */ });
test("an empty line is refused in today's words", async ({ page }) => { /* "A game needs one line about it." */ });
test("where it plays has nothing picked, and Next without a choice says so", async ({ page }) => { /* no radio checked; "Choose where your game plays." */ });
test("the age question offers five choices with nothing picked", async ({ page }) => { /* the five labels and lines; "Choose who your game is for." */ });
test("an 18+ game is asked one more question, and a 12+ game is not", async ({ page }) => {
  /* fillAnswers(files, videos); age 18+ → /marks, "Question 8 of 8"; None of these unticks Gore;
     Back, choose 12+, Next → no marks question; /make/<slug>/marks answers 404 (Review Focus 5) */ });
test("a later question opened too early leads back to the first one not answered", async ({ page }) => {
  const { slug } = await startDraft(page);
  await page.goto(`/make/${slug}/age`);
  await expect(page).toHaveURL(new RegExp(`/make/${slug}/line$`));              // Review Focus 1
});
test("Back goes to the question before, with its answer in place", async ({ page }) => { /* line → Back → the name box holds the name */ });
test("a second press of Next while the first is out makes one game", async ({ page }) => { /* holdAnswersTo, as the old journey did */ });
test("the questions work with script off", async ({ browser }) => { /* a context with javaScriptEnabled: false walks name, line, plays-on */ });
test("another maker cannot open or answer this game's questions", async ({ page, browser, baseURL }) => {
  /* for each address in MAKER_ADDRESSES(slug): GET is 404, and a POST of a valid answer is 404 (Review Focus 2) */ });
test("signed out, the maker's area asks for sign-in and comes back", async ({ page }) => { /* /make → /sign-in?next=/make */ });
test("a waiting game says so, and its one blue button goes back to Your games", async ({ page }) => { /* putGameWhereStaffLeaveIt(waiting) */ });
```

  `MAKER_ADDRESSES(slug)` lives in `support/game.ts` and every later task adds its addresses to it. `make-look.test.ts`, by layout, reading the page's own size (`page.viewportSize()`), not the project's name:

```ts
test("a question: the heading's size, the box and the buttons for this window", async ({ page }) => {
  /* heading font-size is 36, 32, 48 or 64 by the table; the box is 64, 52 or 72 tall with 24px type and 12px corners and no border;
     on a window under 500 wide, under 450 tall, or upright from 500 wide: the buttons sit in a bar whose bottom is the window's bottom;
     otherwise the blue button is at least 168 by 60 and under the box */ });
test("press Enter shows only where there is a mouse", async ({ page, isMobile }) => { /* visible on the computer project only */ });
test("Enter presses the blue button", async ({ page }) => { /* name, Enter → the line question */ });
test("a picked choice has a blue edge, and the others stay white", async ({ page }) => { /* box-shadow holds rgb(--pay); the unpicked background is rgb(--paper) */ });
test("everything to press is at least 44 by 44", async ({ page }) => { /* every a, button, input and label in main, on each built screen */ });
test("a 60-letter name with no space wraps, and nothing scrolls sideways", async ({ page }) => {
  /* scrollWidth <= clientWidth on the line question and on Your games; the blue button is in the window (Review Focus 6) */ });
test("a step: the new question rises over 460ms on the house curve", async ({ page }) => {
  /* after Next, the heading's animation-duration is 0.46s and its timing function cubic-bezier(0.32, 0.72, 0, 1) */ });
test("with reduced motion nothing moves", async ({ page }) => { /* emulateMedia reduce: animation-name is none on the heading and the box */ });
test("the track has one piece per question, and the answered ones are chalk", async ({ page }) => { /* 7 pieces on question 2, 1 chalk... */ });
```

  Stubs where a new export is imported. Push. Expected: `verify` fails in `tests/lib/look.test.ts` only; `browser` fails in the two new files (and nowhere else: `make.test.ts` is gone).
- [ ] **Step 2 (green):** the screens and the stylesheet. Push. Expected: all pass. Look at the attached screenshots on all nine projects beside the board before going on, and write what differs in the tracker.

### Task 5: Where the game's files are

Spec sections 3, 5, 15.1. Owner, 2026-11-15: "GitHub only, with help".

**Files:**
- Modify: `src/features/games/github-connect.ts`, `services.ts`, `src/routes/make/github/+server.ts`, `github/callback/+server.ts`, `src/routes/make/[game]/[question=question]/+page.server.ts`, `+page.svelte`, `src/lib/look.css`
- Create: `src/routes/help/github/+page.svelte`, `+page.server.ts`
- Test: `tests/features/games/github-connect.test.ts`, `tests/features/games/services.test.ts`, `tests/browser/make-questions.test.ts`, `tests/browser/connect-github.test.ts`, `tests/browser/make-look.test.ts`

**Interfaces, produced:**

```ts
sealState(userId: string, nowMs: number, secret: string, game: string | null): string;
/** The game the state was sealed for (or null for none), or undefined when the state does not open. It never throws. */
openState(value: string | undefined, userId: string, nowMs: number, secret: string): { game: string | null } | undefined;
// GitHubConnect: sealState(userId, game), openState(value, userId) follow.
```

- `/make/github?game=<slug>` (and `&choose=1`) seals the game's address into the state. The callback: a state that does not open goes to `/make?github=failed`; a state that opens with a code GitHub refuses goes to `/make/<game>/files?github=failed`; otherwise to `/make/<game>/files`, or `/make` when the state names no game. The callback only redirects, so a game that is not hers is the question's own 404 (Review Focus 7).
- Your games with `?github=failed` shows, above the list: "GitHub didn't connect. Try again."

**The question, "Where are your game's files?"** (3 of 7):

| When | What is on it | Blue button | Links |
|---|---|---|---|
| GitHub not connected | One sheet: "Your game lives on GitHub. Connect it, then pick the folder." and "You choose which repositories Ruken can see. It can't see anything else." Hint: `New to GitHub? <a>Here's how to put your game there</a>` | Connect GitHub (`/make/github?choose=1&game=<slug>`, with `data-sveltekit-reload`) | Back |
| The connection failed | The same, with "GitHub didn't connect. Try again." above the sheet | Connect GitHub | Back |
| Connected, nothing chosen on GitHub | "Ruken can't see any of your repositories yet." | Choose repositories on GitHub | Back |
| Connected | Each repository is a paper row to choose (a `pick`), drawn by Ruken, never the browser's list. Hint: "Your game needs an index.html that runs in a browser." | Next, then "Copying your game…" with the line "Copying your game can take a minute. Keep this page open." | "Don't see your game? Choose it on GitHub"; "Change the branch or folder" (opens two boxes, with today's hints "Leave empty for your main branch." and "Leave empty if index.html is at the top.") |
| The copy was refused | A "Needs fixing" card: "We couldn't start your game". For a missing index.html: "Ruken starts your game from a file called index.html. We couldn't find one in that folder." For any other refusal, the pull's own words. Under it: `<a>Here's how to set up your game's folder</a>` | Pick another folder (opens the branch and folder boxes, the folder in focus) | Back |

Refusal with nothing chosen: "Choose the repository your game is in." A repository typed by hand that GitHub never listed for her is refused in today's words.

The second sentence of the first sheet is kept from spec section 5 beside the board's first: it answers "what can Ruken see?" at the moment she is asked to connect. Call.

New look class `fix`: a white card with a 6px inset left edge in `--pay`, and its label "Needs fixing" in `--pay`, 14px, semibold, sentence case.

**The how-to page, `/help/github`**, open to anyone, one paper sheet on the felt, with a link at the top "Back to your game" (to `?from=`, checked with `safeNext` from `src/lib/safe-next.ts`; without it, "Back to Ruken", to `/`). Its words:

> **Put your game on GitHub**
>
> GitHub is a free website that keeps your game's files. Ruken copies your game from there.
>
> 1. Make a free account at github.com.
> 2. Make a new repository. Give it your game's name.
> 3. Upload your game's files: everything in the folder that has index.html in it.
> 4. Save it. GitHub calls this "Commit changes".
> 5. Come back to Ruken and choose Connect GitHub.
>
> **Set up your game's folder** (the anchor `#folder`)
>
> Ruken starts your game from a file called index.html.
>
> Open index.html on your own computer first. If your game runs in your browser, it's ready.
>
> If your game was made with a game-making tool, export it for the web first. The tool may call this "Web" or "HTML5".
>
> If index.html sits inside another folder, tell Ruken which one. Choose "Change the branch or folder" and write the folder's name, like web/build.

The audit checks each GitHub step against GitHub's own help pages, since no session opened GitHub to write them.

- [ ] **Step 1 (red):** `github-connect.test.ts`: a state sealed with `"floor-fifty"` opens to `{ game: "floor-fifty" }`; sealed with null opens to `{ game: null }`; a changed payload, another account, and a state older than ten minutes are `undefined`. `connect-github.test.ts` and `make-questions.test.ts`:

```ts
test("before GitHub is connected, the files question says what Ruken will see, with a way to learn GitHub", async ({ page }, testInfo) => { /* the two sentences; the how-to link; one blue button */ });
test("connecting from question 3 comes back to question 3, with the first two answers kept", async ({ page }) => {
  /* startDraft, the line, Connect GitHub → the stand-in → /make/<slug>/files; the rows list ruken-test/tiny-game */ });
test("a connection that failed says so on the question, above the way to try again", async ({ page }) => { /* a refused code */ });
test("a state that someone changed lands on Your games, and says GitHub didn't connect", async ({ page }) => { /* Review Focus 7 */ });
test("a state for another maker's game lands on a 404, never on her question", async ({ page, browser }) => { /* connectStateFor(userId, otherSlug) */ });
test("connected with nothing chosen, she is told, with one way to choose some", async ({ page }) => { /* forgetTheirRepositories */ });
test("she picks a repository from Ruken's own rows, and Next copies the game", async ({ page }) => { /* no <select> on the page; Next → /plays-on; the game has a pull */ });
test("while the game is copied the button says so and cannot be pressed again", async ({ page }) => { /* holdAnswersTo; "Copying your game…"; disabled; the minute line shows */ });
test("a repository with no index.html says so in plain words on the question that asked", async ({ page }, testInfo) => {
  /* the broken repository: the Needs fixing card with its two sentences; the how-to link; Pick another folder opens the folder box, focused; her choice is still picked */ });
test("a folder that cannot be right is refused beside its box", async ({ page }) => { /* "/web" → today's folder words */ });
test("a repository GitHub never listed for her is refused", async ({ page }) => { /* page.route changes what is posted */ });
test("the how-to page is plain steps, and leads back to her question", async ({ page }) => { /* five numbered steps; #folder; Back to your game → the files question */ });
test("the how-to page will not send anyone to another site", async ({ page }) => { /* ?from=https://example.com → the link is "/" */ });
```

  `make-look.test.ts`: the Needs fixing card is paper with a blue left edge and holds no `--pip`; its label is not uppercase (`text-transform: none`). Push. Expected: `verify` fails in `github-connect.test.ts`; `browser` in the new cases.
- [ ] **Step 2 (green):** Push. Expected: all pass.

### Task 6: The two videos

Spec 5a notes 1 and 7, 5b "The videos are real", 15.3.

**Files:**
- Create: `src/routes/make/parts/VideoTile.svelte`, `src/lib/quiet-video.ts`
- Modify: `src/routes/make/[game]/[question=question]/+page.server.ts`, `+page.svelte`, `src/routes/make/+page.svelte`, `src/lib/look.css`
- Delete: `src/routes/make/[game]/ClipPicker.svelte` (its picker's behaviour moves into the question)
- Test: `tests/lib/quiet-video.test.ts`, `tests/browser/make-questions.test.ts`, `tests/browser/make-look.test.ts`

**Interfaces, produced:**

```ts
// src/lib/quiet-video.ts
/** Whether a video may start by itself here: never with reduced motion or Save-Data, nor on a device that reports under 4 GB of memory. */
export function mayAutoplay(env: { reducedMotion: boolean; saveData: boolean; deviceMemory: number | undefined }): boolean;
/** A Svelte action: starts a muted, looping video only where mayAutoplay says so. Without script a video shows its first frame. */
export function quietVideo(node: HTMLVideoElement): void;
```

`VideoTile.svelte` props: `{ src: string | null; shape: "upright" | "wide"; label?: string; still?: boolean; changeHref?: string }`. With a `src` it is a muted, looping, `playsinline` `<video preload="metadata">` using `quietVideo`; `still` never plays (Your games). Choosing it opens the video full size in a `<dialog>`: on black, with the browser's own controls, a green "Close" button at the top right, and Escape closes it. Without script it is a link to the video itself. With no `src` it is a plain sage block.

**The questions** `upright` (5 of 7) and `wide` (6 of 7), the same screen twice:

- Headings: "Add your upright video", "Add your wide video".
- The video's frame is the biggest thing on the screen, there before any video is chosen, in its real shape, in `--felt-raised`, saying "Taller than wide" or "Wider than tall". Choosing the frame opens the picker, the same as the blue button. Sizes (spec 5a note 1): upright 540 tall beside the question on a computer and a sideways tablet, 500 tall under it on an upright tablet, 340 tall on a phone, 250 tall beside it on a sideways phone; wide 640 wide under the question on a computer and tablets, the full width on a phone, 380 wide beside the question on a sideways phone.
- Hint, upright: "Record your screen while you play for 10 to 30 seconds. Players see it in the feed before they play." and, as a note, "For phones: taller than wide. MP4 or WebM, up to 30 MB." Wide: the same with "For computers: wider than tall."
- Until a video is in, the blue button is "Choose video" (Ruken's own picker over the real file field, reachable by keyboard, as today), with no Enter hint. Choosing a file adds it at once: the button reads "Adding your video…" and cannot be pressed twice. Without script a second button, "Add this video", sends the form.
- Once a video is in: it plays in the frame, the blue button is "Next", and "Choose a different video" is a link under the buttons.
- Refusals are today's words (`videoChoiceProblem` in the browser, `clipProblem` on the server), under the hint, with the file's name and size.
- The 31 MB guard before the body is read stays.

Where a game's still comes from (spec section 8): no picture is made or stored. A card in Your games shows the wide video's first frame through `VideoTile` with `still`; a game with no wide video keeps the sage block. Whether the feed needs a real picture is slice 3's to decide.

How a video plays full size (spec section 8): the `<dialog>` above, on every device.

- [ ] **Step 1 (red):** `quiet-video.test.ts`: `mayAutoplay` is false for each of reduced motion, Save-Data and 2 GB, and true for none of them with 8 GB or with memory unknown. Journeys:

```ts
test("the upright question shows its frame before anything is chosen, in the right shape", async ({ page }, testInfo) => { /* "Taller than wide"; the frame is taller than wide; Choose video is blue; no "press Enter" */ });
test("a video is added the moment it is chosen, then Next is the blue button", async ({ page }) => { /* chooseVideo; a <video> with a src on the media address; Next; "Choose a different video" is a link */ });
test("the wide question follows, and after it the age question", async ({ page }) => { /* upright → wide → age */ });
test("a video of the wrong kind or size is refused in plain words before anything is sent", async ({ page }) => { /* the .mov words; the 31 MB words; no request left the page */ });
test("a web page named as a video is refused by the server, under the hint", async ({ page }) => { /* "That file doesn't look like a video. …" */ });
test("choosing the video opens it full size, and Close and Escape close it", async ({ page }) => { /* dialog[open]; controls; green Close */ });
test("with reduced motion a video does not start by itself", async ({ page }) => { /* emulateMedia; the video is paused */ });
test("the picker is reached and opened from the keyboard", async ({ page }) => { /* as the old journey at line 788 */ });
test("a game's card in Your games shows a still from its wide video", async ({ page }) => { /* fillAnswers(videos): a video with preload=metadata and no autoplay; 96×54 or 128×72 by window */ });
```

  `make-look.test.ts`: the frame's height or width for this window, from the list above. Push. Expected: `verify` fails in `quiet-video.test.ts`; `browser` in the new cases.
- [ ] **Step 2 (green):** Push. Expected: all pass.

### Task 7: The agreement, and Check and send

Spec sections 3, 5 (the agreement, Check and send), 5a note 2, 5b.

**Files:**
- Create: `src/routes/make/[game]/agreement/+page.server.ts`, `+page.svelte`, `src/routes/make/[game]/check/+page.server.ts`, `+page.svelte`, `src/routes/make/parts/GameLaidOut.svelte`
- Modify: `src/features/make/library/maker-agreement-v1.txt`, `src/routes/legal/maker-agreement/+page.svelte`, `src/routes/make/[game]/[question=question]/` (the `websites` question), `src/lib/look.css`
- Test: `tests/features/make/agreement.test.ts`, `tests/browser/make-send.test.ts`, `tests/browser/make-look.test.ts`

- **The agreement's date.** Owner, 2026-11-14: "A". The file's first line becomes `Ruken maker agreement, version 1, 14 November 2026`; nothing else in the file changes. Both screens show "Version 1 · Last updated 14 November 2026" under the title, read from the file.
- **`/make/<game>/agreement`**, only for a maker who has not agreed (anyone else is sent on to `check`): over the heading "Almost done"; the heading "The maker agreement"; the version line; all seven points as one sheet, each a number in Young Serif, a bold title and its words (`Points.svelte`, as `/legal/maker-agreement` sets them); blue "I agree"; green "Back" (to the last question). Pressing "I agree" is the agreeing: `agree`, then `check`. No tick box, no fold-out, no link out.
- **`/make/<game>/check`**: a question still unanswered redirects to it; a maker who has not agreed is sent to `agreement`. Over the heading "Last step"; the heading "Check it, then send"; blue "Send for review", then "Sending your game…"; links "Finish later" and "Throw this game away". After a send: `/make/<game>`, which now says "Waiting for review". The service's refusal, if it ever comes, shows under the heading in its own words.
- **`GameLaidOut.svelte`**, props `{ game: MakerGame; media(key: string): string; change: GamePart[] }`: the game as members will see it, with a small "Change" on each part named in `change`.
  - Its two videos as `VideoTile`s side by side in their real shapes and the same height (264 on a computer, 300 on an upright tablet, 180 on a sideways phone; on a phone the upright one at 150 by 267 with the wide one beside it), labelled "On phones" and "On computers".
  - Its name in Young Serif at 32px and its line under it at 24px in sage.
  - Quiet chips (`--felt-raised`, white words, 8px corners): the repository ("your-name/floor-fifty"); "Plays on phones and computers" or "Plays on computers only"; the rating ("12+", or "18+ · Gore" with its marks; "18+" alone for "None of these"); and "Runs on its own" or "Uses api.example.com".
  - Not shown: file sizes, the file count.
  - "Change" opens that part's question (`questionOf`), which reads "Save" and comes straight back.
- **The `websites` question** (reached only from that chip): heading "Does {name} use other websites?"; one box; hint and refusal in today's words for the websites box; blue "Save", then "Copying your game…", since the game is copied again with the new list.
- New look classes: `chip`, `tiles`, `title` (the name as a title), `tagline`.
- Two halves (`halves`): on a computer, a sideways tablet and a sideways phone, the heading and the blue button on the left (480 wide; 260 on a sideways phone) and the game on the right; on a phone and an upright tablet, stacked, with the button in the bar.

- [ ] **Step 1 (red):** `agreement.test.ts`: the held-back test, now due: `parseAgreement(MAKER_AGREEMENT_TEXT).updated` is "14 November 2026", and the file has seven points. `make-send.test.ts`:

```ts
test("a first game: seven questions, the agreement, Check and send, then Waiting for review", async ({ page }, testInfo) => {
  /* the whole run through the real screens with the stand-in GitHub and two videos; each screen attached for the Owner;
     ends on "Waiting for review" with the blue "Back to your games" */ });
test("the agreement is shown whole, with its version and date, and one button", async ({ page }) => { /* seven numbered points; "Version 1 · Last updated 14 November 2026"; no checkbox on the page */ });
test("I agree is the agreeing, and a second game is not asked again", async ({ page }) => { /* the second game goes from the last question straight to check */ });
test("Check and send lays the game out: two videos, its name and line, and four chips", async ({ page }, testInfo) => {
  /* "On phones", "On computers"; the name; the line; the repository; "Plays on computers only"; "12+"; "Runs on its own" */ });
test("an 18+ game's chip names its marks", async ({ page }) => { /* "18+ · Gore" */ });
test("Change opens that one question, which says Save and comes straight back", async ({ page }) => {
  /* Change beside the line → /line with a "Save" button and no counter → Save → /check with the new line */ });
test("the websites chip opens the websites question, and a name that is not a website is refused in its own words", async ({ page }) => { /* then a good one: "Uses api.example.com" */ });
test("Check and send opened with a question unanswered leads to that question", async ({ page }) => { /* Review Focus 1 */ });
test("while a game is sent the button says so and cannot be pressed again", async ({ page }) => { /* "Sending your game…" */ });
test("the maker agreement stays a page anyone can read", async ({ page }) => { /* /legal/maker-agreement, signed out: title, version line, seven points, a way back */ });
```

  `make-look.test.ts`: on Check and send the blue button is inside the window without scrolling on every project; the two tiles are the same height; a chip's corners are 8px; nothing scrolls sideways. Push. Expected: `verify` fails in `agreement.test.ts`; `browser` in `make-send.test.ts` and the new look cases.
- [ ] **Step 2 (green):** Push. Expected: all pass.

### Task 8: Waiting, Sent back and Live

Spec sections 5, 5b "Sent back, now", 5c, 15.1.

**Files:**
- Modify: `src/routes/make/[game]/+page.server.ts`, `+page.svelte`, `src/routes/make/parts/StateScreen.svelte`, `src/lib/look.css`
- Test: `tests/browser/make-after.test.ts`, `tests/browser/make-look.test.ts`

All three are two halves: the name, the heading, one line and the buttons on one side; the game on the other.

- **Waiting.** Heading "Waiting for review"; "We're looking at it. Come back here to see when it's live."; blue "Back to your games"; a link "Change something", which opens `check`. Nothing else.
- **Sent back.** Heading "Sent back".
  - While something is in `toFix`: the line from `toFixWords`. One "Needs fixing" card (`fix`) for each thing: its `title` in Young Serif, its `words`, staff's own line under them when there is one, the video itself playing when it is a video, and "Fix this". The whole card is one link to that part's question. The blue button names the first one: "Fix the upright video" (`partNoun`). "Send it again" is not on the screen.
  - What passed is folded away in one green card (`--felt-raised`, white words): "6 accepted" with "Show" (a `details`). Opened, it is the game laid out (`GameLaidOut`) with "Change" on every part.
  - Once `toFix` is empty: the line reads "Fixed. Send it again when you're ready.", the green card is open and reads "All 8 ready to send", and the blue button is "Send it again", then "Sending your game…".
  - A link "Back to your games"; the small "Throw this game away".
  - The count is of the eight parts: name, one line, game files, where it plays, the two videos, who it's for, other websites.
- **Live.** Heading "Live"; "Players can find it on Ruken."; blue "See it on Ruken" (a link to `/g/<game>`; branch F builds that page, so until F merges the link leads nowhere and no live game exists outside a test); a quiet blue outline "Send a new version", with today's note under it and "Copying your game…" while it runs (it copies the newest files and sends them for review in one press, as today's `pull` action does); a link "Back to your games".
  - Beside them, sharp: the game laid out with one video (the upright one on an upright screen, the wide one on a wide screen), its name and line, and where it plays, with "Change" on the name, the line and where it plays only.
  - While an update waits: the line reads "Your update is waiting for review." An update that was sent back: one "Needs fixing" card with its words above the laid-out game, and the line "Fix it, then send a new version."
  - **The statement piece** (5c). Only here, the game's own video fills the screen behind everything: the upright one on an upright screen, the wide one on a wide screen, muted, looping, through `quietVideo`; blurred 18px, at 55% brightness, under a layer of `--felt-deep` at 50%. Five soft circles of `--sage` at 12% drift slowly between the video and the dark layer. Where `mayAutoplay` is false (Task 6) the video stays on its first frame and the circles do not move: that is the answer to the spec's open question about slow phones, and it is not measured on a real phone. New look class `live`.
- A game that is `taken_off` or `taken_down` shows its headline and "Back to your games" only; Task 31 and slice 4 build those screens.

- [ ] **Step 1 (red):** `make-after.test.ts`:

```ts
test("sent back for one thing: the screen leads with it, the blue button names it, and Send it again is not there", async ({ page }, testInfo) => {
  /* putGameWhereStaffLeaveIt({ state: "sent_back", toFix: [{ part: "upright_video", reason: "sideways" }] });
     "One thing to fix. Then send it again."; a card "Needs fixing" / "Upright video" / "It's sideways. Turn it the right way up." with the video in it;
     the blue button is "Fix the upright video"; no "Send it again"; "7 accepted" folded */ });
test("staff's own line shows under the reason", async ({ page }) => { /* something_else with a note */ });
test("fixing the one thing brings back Send it again, and sending makes it wait", async ({ page }) => {
  /* the card → /upright → a new video → Save → "Fixed. Send it again when you're ready."; "All 8 ready to send"; Send it again → Waiting for review */ });
test("sent back for two things, one fixed: still no Send it again, and a send posted by hand is refused", async ({ page }) => { /* Review Focus 4: "Fix what was sent back first." */ });
test("a rude name is fixed on the name question", async ({ page }) => { /* "Name: …"; "Fix the name"; a new name moves the game's address and the screen follows it (Review Focus 3) */ });
test("a waiting game can still be changed, through Check and send", async ({ page }) => { /* Change something → /check */ });
test("a live game: See it on Ruken is the blue button, and a new version goes for review on one press", async ({ page }, testInfo) => {
  /* the href is /g/<slug>; Send a new version is an outline; after it, "Your update is waiting for review." */ });
test("a live game's name changes and its address stays", async ({ page }) => { /* Change → the hint about links → Save → same slug, new name */ });
test("a live game offers no Change on its videos or its files", async ({ page }) => { /* and /upright posted by hand is refused */ });
test("a live game's update that was sent back says what to fix", async ({ page }) => { /* one Needs fixing card; "Fix it, then send a new version." */ });
test("another maker cannot open any of these", async ({ page, browser, baseURL }) => { /* MAKER_ADDRESSES, now with agreement, check and the three states */ });
```

  `make-look.test.ts`: on Live the page's background is not the felt (a video element sits behind `main`, with `filter` holding `blur(18px)`); with reduced motion that video is paused; white words on Live are still `--chalk`; on Sent back nothing is `--pip`; the blue button is in the window without scrolling on every project. Push. Expected: `browser` fails in the new cases only.
- [ ] **Step 2 (green):** Push. Expected: all pass.

### Task 9: Throwing a draft away

Spec section 5 ("Throwing a draft away") and section 1.

**Files:**
- Create: `src/routes/make/[game]/throw-away/+page.server.ts`, `+page.svelte`
- Modify: `src/routes/make/+page.server.ts`, `+page.svelte`, `src/routes/make/parts/QuestionScreen.svelte`, `[game]/check/+page.svelte`, `parts/StateScreen.svelte`
- Test: `tests/browser/make-after.test.ts`

- The small link "Throw this game away" is at the foot of every question about a game that exists, of Check and send, and of Sent back. A waiting, live, taken-off or taken-down game has no such link, and `/make/<game>/throw-away` is a 404 for it.
- `/make/<game>/throw-away`: heading "Throw {name} away?"; "Its files and videos are deleted from Ruken. Nothing changes on GitHub."; "You can't undo this."; green "Keep it" (a link back to `/make/<game>`, in focus when the screen opens); red "Throw it away" (a form that posts to `/make?/throwAway` with the game's address). No blue button, and no field, so Enter has nothing to press but the focused "Keep it".
- The action on Your games calls `throwAway` and answers with the game's name; Your games then shows, once, above the list: "{name} was thrown away." A second post of the same form (a reload) finds no game and shows the plain list.

- [ ] **Step 1 (red):**

```ts
test("a draft is thrown away: green keeps, red deletes, nothing is blue, and Your games says so once", async ({ page }, testInfo) => {
  /* the three lines; Keep it is --felt-raised and focused; Throw it away is --pip; filledButtons is 0;
     after: "… was thrown away."; the game is not in the list; a reload of /make no longer says it */ });
test("Keep it changes nothing", async ({ page }) => { /* back on the game's question */ });
test("its files and videos are gone, and its name can be used again", async ({ page, request }) => {
  /* fillAnswers(videos) with real objects in the bucket; after: the clip's address answers 404; a new game with the same name gets the plain address (Review Focus 8) */ });
test("a game that is waiting or live has no way to be thrown away", async ({ page }) => { /* no link; the address is 404; a post by hand changes nothing */ });
test("a sent-back game can be thrown away", async ({ page }) => {});
```

  Push. Expected: `browser` fails in these cases only.
- [ ] **Step 2 (green):** Push. Expected: all pass.

### Task 10: What players will see

Spec 15.4. Owner, 2026-11-15: "Use the right side".

**Files:**
- Create: `src/routes/make/parts/GamePreview.svelte`
- Modify: `src/routes/make/parts/QuestionScreen.svelte`, `src/routes/make/new/+page.svelte`, `src/lib/look.css`
- Test: `tests/browser/make-look.test.ts`

- On a computer and a sideways tablet, a question about a game puts the question at the left edge and, in the right third (340 wide; 260 on a sideways tablet), the label "What players will see" and one paper card: the upright video (a sage block until there is one), the name, the line, and the rating as a chip. A part not answered yet shows in grey: "Its name", "Its one line". It changes as she types and picks; without script it shows what is saved.
- On a phone, a sideways phone and an upright tablet there is no preview: the question has the screen.
- The maker's handle is not shown: nobody has one until slice 3.
- The `websites` question shows the same card (players see nothing of the answer; a card of its own is not drawn anywhere in the spec).
- New look classes: `asks` (the question and the preview side by side), `preview`.

- [ ] **Step 1 (red):**

```ts
test("beside a question on a wide screen, a card shows what players will see, and follows what she types", async ({ page }, testInfo) => {
  /* only where the window is landscape, at least 500 wide and 450 tall: the label; "Its name" in grey; typing "Floor Fifty" puts it on the card before Next;
     on the age question, choosing 12+ puts a "12+" chip on it */ });
test("on a phone, a sideways phone and an upright tablet there is no preview", async ({ page }) => { /* the label is not visible */ });
test("the preview's label is not in capitals", async ({ page }) => { /* text-transform: none */ });
```

  Push. Expected: `browser` fails in these cases only.
- [ ] **Step 2 (green):** Push. Expected: all pass.

### Task 11: Clean up, show every screen, hand over

No test cycle of its own; nothing here changes what a screen does.

- [ ] **Step 1:** Remove what nothing uses any more: old look classes (`file`, `step`, and any rule only the old form or checklist used) with their names in `CLASSES`; old exports from `games.ts`; the old words in `review.ts`. `tests/lib/look.test.ts` already fails on a class in `CLASSES` that no screen uses, or on a class a screen uses that is not there; if it does not, add that case first, red. Push. Expected: all pass.
- [ ] **Step 2:** Every screen of this plan is attached with `showTheOwner` on all nine projects (each journey above already does it for its screen). Check the `playwright-report` artifact of the last green run holds, for each of these, one picture per project: Your games (none, some); each of the eight questions and `websites`; the files question's five states; a video question before and after; the agreement; Check and send; Waiting; Sent back (one to fix, all fixed); Live; Throw away; the how-to page; Your account; deleting an account. Write the run number and artifact id in the tracker, with anything that is missing.
- [ ] **Step 3:** Update `docs/superpowers/progress.md`: the slice 2 row and percentage, the branch M row, the carried-journeys table from Task 4, every deviation and Call, what ran and what did not. Send the coordinator the summary.
- [ ] **Step 4:** #63 stays a draft. It is marked ready only after the implementation audit, the screen review (CLAUDE.md, "The screen review": every screen on every view; then the two Fable passes and the Opus walk the Owner asked for before they see a design), and the Owner's "fine" on the screenshots.

---

## Branch S after M: Tasks 30 and 31, amended

Branch S is not built from this section alone: read it with Tasks 30 and 31 in the slice 2 plan. It starts from `main` after #63 merges. Only what the redesign changes is here.

**Task 30, Accept and Send back.** The staff screens are pinned as drawn; this builds only "Checking a game" (spec 11.1 screen 2, the board's `check` screen), and the list that leads to it.

- `sendBack` now takes parts. The page lists the game's eight parts, each with a box "This is wrong" (44 by 44). A ticked part shows its reasons (`reasonsFor`, staff's words) to choose one from, and "Something else" opens a box for a line of staff's own. One blue button under the name, always in view: "Accept" while nothing is ticked, "Send back" once something is. Refusals are the service's: "Pick a reason for each part you ticked.", "Say what's wrong in your own words.".
- The age rating: the maker's choice shown as the five choices, and staff can choose another before Accept; an 18+ game shows its three marks, which staff can add or remove. `accept` gains a third argument, `{ ageRating: AgeRating; contentMarks: ContentMark[] }`, kept on the game with the yes. The maker's screens already show whatever the game holds.
- A ticked box and a chosen reason are blue, never red (15.1).
- The journey "staff send a game back, and the maker reads why" ticks the upright video with "It's sideways." and reads "It's sideways. Turn it the right way up." on the maker's Sent back screen.
- `submitGame` and `addGame` in `tests/browser/support/game.ts` walk the new questions (this plan's helpers).
- Not built: the one queue for everything, extras' play switches, reports, and every other staff screen.

**Task 31, a maker takes a game off Ruken.** Spec 13.1 M1 and M2.

- `deleteAll` already exists (Task 3 of this plan); Task 31 no longer adds it.
- On Live, under the buttons, a quiet link "Take {name} off Ruken". Its screen: heading "Take “{name}” off Ruken?"; "Players can't find it or play it."; green "Keep it on Ruken", red "Take it off"; no blue button. The lines about refunds for extras come with sales.
- Afterwards the game's screen reads "Taken off Ruken", with "You took it off on {date}. Players can't find it." and blue "Put it back on Ruken", which copies the newest version and sends it for review.
- The old plan's confirm screen and its "No red" line are replaced by the above.

## Notes for the plans that follow

- **F (play).** The game's page at `/g/<game>` is what "What players will see" imitates; if F changes what that page leads with, `GamePreview.svelte` follows. `liveGameBySlug` now answers the rating and marks. Every button F adds follows Task 1's rule.
- **Slice 3.** The first-game page questions join this run before the game's (spec section 6); `questions.ts` counts only a game's questions, so the page's questions need their own list and one shared counter. The preview gains the maker's handle. Your games gains the doors to Your page.
- **Sales, beta, apps.** Their question runs reuse `QuestionScreen`, `Picks` and the two-halves layout. The rooms list on Live arrives with the first room.
- **Slice 4.** "Taken down" uses the `fix` card and `Game.stateReason`. A game sent back for pornography "cannot be sent again as it is" (spec section 12): not enforced here; any new copy of the files clears the part.
- **Not checked in the plan session:** the board's sizes against a real browser; whether WebKit runs `document.startViewTransition` on the projects' version (the step falls back to no exit movement where it does not); what Live's background costs on a real slow phone; GitHub's own labels for the how-to page.
