# Implementation audit, early: slice 2 code already on main (branches A to E, P, S0, T, Task 19, and M)

Asked for by the Owner (2026-11-15, "1. A"): a find-only audit of what slice 2 has merged so far, so the slice's final implementation audit needs to cover only branches S, F and G. This audit changes no code. Its fixes are made later, in a separate session, and only in files branch S is not touching (the slice 2 rest plan's file map lists S's files). Each finding says whose files it is in.

Audited:

- `main` at `5c742c8`: branches A `slice-2/game` (#44), B `slice-2/storage` (#47), C `slice-2/github-pull` (#50), D `slice-2/gate` (#51), E `slice-2/connect-github` (#52), P `slice-2/play-rules` (#60), S0 `slice-2/first-owner` (#48), S's Task 19 (#78), T `slice-2/test-address` (#125) and its audit's fixes (#128). All ten pull requests were read as merged on GitHub.
- Branch M `slice-2/submit` (#63) at its head `f6086e0`. It was **not on main yet** when this was written: marked ready, auto-merge on, `verify` and `postgres` green, three of the six browser pieces still running. Its findings stand for what lands; if a later push changes a file named here, that finding is to be read again.

Against: the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`), the maker screens design (`2026-11-14-maker-screens-redesign-design.md`), the slice 2 plan (`docs/superpowers/plans/2026-11-13-slice-2-games-play.md`) and its audit, the maker screens rebuild plan and its reviews, the slice 2 rest plan (`2026-11-15-slice-2-rest.md`) and its audit, the test address audit, `docs/superpowers/progress.md`, `CLAUDE.md` and the project instructions.

What ran: no test, lint or typecheck (CLAUDE.md: tests run only on GitHub's runners). Read in full: every file under `src/features/games/`, `src/features/play/`, `src/lib/files/`, `cloudflare/games/`, `src/routes/make/github/`, `src/routes/jobs/first-owner/`, `src/features/accounts/staff.ts`, `src/lib/server/job-secret.ts`, `prisma/schema/games.prisma` and `play.prisma` with their migrations' hand-written parts; on M, `src/features/games/service.ts`, `services.ts`, the diffs of `clips.ts`, `files-check.ts`, `github.ts`, `pull.ts`, `gate.ts`, `store.ts`, `r2-store.ts`, `content-types.ts`, all four of M's migrations, `make.prisma`, `src/features/make/agreement.ts` and the agreement's text, and the server files of `/make`, `/make/new`, `/make/[game]`, `/make/[game]/[question]`, `check`, `agreement`, `take-off` and `throw-away`. M's Svelte screens were not read line by line: they had the full visual review (plain words, design pass, end-to-end walk, second look) and the Owner's "Fine" (2026-11-15). The test files were read for their case names against the plan's Review Focus list, not line by line; CI results are taken from the tracker, which names each run.

## Verdict

**Nothing blocks.** The code on main does what the plan says, in the plan's shapes, and the untrusted-game rules hold: a game's files load only under a signed pass for that game and pull, from an address that is never Ruken's; the pass names no person; the gate sets and reads no cookie; paths that climb out are refused before the bucket is asked; play time comes from the server's clock only. Every Review Focus item for branches A to E and P has its test.

There are **6 should fix**, **4 small**, **1 that needs the Owner's choice**, and **9 notes**. Three of the should-fix findings (S-1, S-2, S-6) are in `src/features/games/service.ts` or M's take-off screen, which branch S rewrites; they are written so S's build, or its audit, can take them. S-3, S-5 and the small ones L-1, L-2 and L-4 are in files S does not touch, so the fix session can take them now. S-4 belongs to branch F.

## What was checked, and holds

1. **Tables and their rules.** `Game`, `GamePull`, `GameClip`, `GitHubInstallation`, `GitHubRepository`, `PlayPass`, `PlaySession`, `PlayBeat` are as the plan's tables, with every hand-written CHECK the plan lists (public id, slug, folder, live needs files, commit id, counts, pass id, pass time, token hash, "only a free game is played by nobody") and the add-only trigger on `GamePull`, `PlayPass`, `PlaySession` and `PlayBeat`, attached as the membership migration attaches it. M adds `GameReview`, `GameReviewPart` and `MakerAgreement`, each add-only, and `Game_answered_check`, `Game_marks_check` and `GameReviewPart_note_check`.
2. **Safe paths and file types** (`src/lib/files/`). `normalizePath` refuses `..`, `.`, empty segments, backslashes, NUL and an encoded `/` or `\`, and answers NFC. `servedTypeFor` comes from the name only, answers plain bytes for anything unknown (a dot-file, no extension, `main.js.constructor`), and treats `.br`/`.gz` as precompressed only over a known inner type. The three files import nothing from a feature, so the gate bundles them.
3. **The file check** (`files-check.ts`). The rules run in the plan's order with the plan's words (M later reworded them in plainer words, through its plain-words review); the limits are FloorFifty's measured build times four, with the comment that says so; `connectHostsFrom` refuses a scheme, a path, `*`, a name with no dot, six names and a repeat.
4. **The pull** (`pull.ts`). One commit is resolved once and read twice; the first read stores nothing and stops as soon as the count or total passes its limit; a refusal stores nothing and writes `pullProblem`; files go under `files/<public id>/<pull id>/`, never over a live pull's; the `GamePull` row and clearing `pullProblem` are one transaction; `livePullId` is not touched.
5. **The tarball reader** (`tar.ts`). One `Uint8Array` of the entry's exact size, pieces copied in (no join at the end); an entry not read is skipped without being held; pax `x`, GNU `L` and pax global `g` headers are handled; a stream that ends inside an entry says "The download ended early."
6. **GitHub** (`github.ts`, `github-connect.ts`). Both PEM forms sign (PKCS#1 wrapped in code); `iat` a minute back, `exp` nine minutes on; a token for one repository with `contents: read` only; the repository and branch are checked before any request; no error holds a token or a secret. Connecting asks GitHub as the person which installations and repositories they can reach, never trusts the installation number in the address, keeps a next page only on GitHub's own API address, and the state is sealed for the account for ten minutes with its own MAC prefix. `createGame`/`saveAnswer` ask again, at use, that the same installation still holds the repository (Review Focus 17 and 23).
7. **The games service settings** (`services.ts`). A stand-in GitHub address is refused unless it starts `http://127.0.0.1:`; `GAME_ADDRESS_PATTERN` is checked at start; the bucket is looked up per use, as the Workers binding requires.
8. **The pass** (`pass.ts`). `v1.<payload>.<mac>`, HMAC-SHA256 with its own prefix, compared in constant time; the payload's every field is checked for shape; `exp` is whole seconds, so a pass rebuilt from its row is the same string. `passFor` gives one member the same pass for one game's pull while four hours are left, a new one after, and never one pass to two members; signed-out players of a free game share one.
9. **The gate** (`gate.ts`, `cloudflare/games/`). GET and HEAD only; a service worker's script is refused; a pass for another game is refused; `/<pass>` is sent on to `/<pass>/`; the CSP is `frame-ancestors <site>; connect-src 'self' blob: data:` plus the pass's own servers; `cache-control` runs out with the pass; clips and photos only for keys of exactly their shape; byte ranges, 304 and 416 as carried; `robots.txt` and the health check; path mode only on `PATH_HOST`. The Worker imports `gate.ts` and `r2-store.ts` and nothing else.
10. **Who may play** (`may-play.ts`). Own game, then staff, then a free game, then member: the first three never count for pay (design 6). A phone is `Mobi` or `Android`. "Not now" goes back only to a well-formed `/g/<slug>`.
11. **Sessions and beats** (`sessions.ts`, `time.ts`). Nothing is stored and no pass handed out for someone who may not play; the rate limit is per address; the token is shown once and only its hash kept, compared in constant time; the first beat is never too soon (Review Focus 24); a beat closer than 5 s is dropped; a session takes beats for a day; `countedMs` adds at most 45 s a beat and never more than the server's clock saw.
12. **The first staff account** (S0). Only with `JOBS_SECRET` (hashed compare, 404 without); only while no staff account exists, under an advisory lock so two calls make one owner; the email is lower-cased as sign-up keeps it.
13. **The purge** removes a person's GitHub installations and their repositories with them (`deletion.ts`). Play rows, reviews and the maker agreement keep their account id, since the purge keeps the `User` row.
14. **Layers.** `games` imports `lib` and its own files; `play` imports `games` through its entry; the gate imports no feature entry; routes reach features through their entry files. No `Date.now()` in feature code (the gate Worker reads the clock at the edge, as planned). No new dependency.
15. **M's service, read against the rebuild plan and the maker screens design.** Every route finds its game among the signed-in maker's own (`ownGame`), so another maker's game is a plain 404 (Review Focus 19). Answers arrive from a form and are checked again in the service. A live game takes only its name, line and where it plays; its videos cannot change (`saveClip` refuses a live game). Accept and send back are each one transaction with their review row. A live game sent back stays live on its old files (Review Focus 18). Throwing away keeps the row, frees the name and deletes the game's files and clips. `deleteAll` refuses a prefix with no trailing slash.

## Findings

### S-1 (should fix; in `service.ts`, branch S's file): a waiting game can change after staff have looked, and Accept puts the change live

While a game waits for review, its maker may change every answer (the design's "Change something" on Waiting opens Check and send) and its videos (`saveClip` refuses only a live game). Each change is saved at once. `accept(gameId, staffUserId)` takes no sign of what staff saw: it makes the waiting pull live with whatever name, line, rating, marks and videos the game has at that moment. So a game can be checked as 12+ with one video, changed to another video or rating while the check page is open, and accepted as changed. `pendingSince` does not move and staff are not told. The files are safe (a new copy replaces the pending pull, and the pull carries its own server list); everything else is not. Design 5.5: a person checks a game before it goes live.

Fix: Accept and Send back carry what the check page showed (for example the game's `updatedAt` and both clip keys, in hidden fields) and the service refuses, in staff's words ("This game changed while you were looking. Look again."), when the game no longer matches. Branch S's Task 30 already changes `accept` ("accept takes the rating"), so S should take this in the same change.

### S-2 (should fix; M's interim take off, which S's Task 31 replaces): taking a game off says it can't be undone and leaves its files loading

M ships `takeOff` and `/make/<game>/take-off`. Against the Owner's decision of 2026-11-14 (a game taken off leaves at once, its files are deleted so every pass loads nothing more, and "Put it back" sends it through review again):

- The screen says "You can't undo this." and the code comments say the same (`take-off/+page.server.ts`, `service.ts` `takeOff`). The rest plan's screen says "You can put it back later. We'll check it again first."
- No file is deleted. A member who has the game open, or opens it again from the same pass's address, keeps loading its files for up to a day. The screen tells the maker "Players won't be able to find it or play it any more."
- `livePullId` stays set on a `taken_off` game; no `MakerAction` row is written.

S's Task 31 is written to replace all three (the rest plan, Task 31). This is listed so S's build and S's audit check that the old words and comments go too, and so nobody reads main between M and S as the finished take off. Until S lands, a game taken off on the test site keeps its files.

### S-3 (should fix; `pull.ts` and `github.ts`, not S's files): a copy that fails halfway leaves its files in the bucket for good

The second read of a pull stores each file as it goes (`pull.ts`, the `folderEntries` loop), and the `GamePull` row is written only after the last one. If anything fails in between (GitHub drops the download, R2 refuses a put, the request is cut off), the files stored so far stay under `files/<public id>/<pull id>/` with no row naming them, and nothing ever removes them; only throwing the whole game away would.

One path to it is certain: `commitOf` answers whatever text GitHub sends (`(await response.text()).trim()`, `github.ts`) without checking that it is a commit id. Anything that is not 40 lower-case hex characters is refused by `GamePull_commitSha_check`, but only at the very end, after every file was copied: the maker sees "Something went wrong" and the bucket keeps the copy.

Fix: in `commitOf`, refuse an answer that is not `^[0-9a-f]{40}$` with an `Error` that names the path (before anything is read); in `pullGame`, wrap the copy and the row in a `try` that, on any failure, calls `deleteAll("files/<public id>/<pull id>/")` and throws again. A test for each: a fake GitHub that answers `"main"` as the commit stores nothing; a fake bucket whose third `put` throws leaves no key under the pull's folder.

### S-4 (should fix; branch F, Task 22): beats keep counting for a game that is no longer live

`recordBeat` checks the session's token and its day, and nothing about the game. A tab left open on a game that was taken off (or, after S, one whose files are gone) keeps sending beats for up to 24 hours, and each attentive one is counted; slice 5 counts `member` sessions' beats for pay (design 6). The page keeps running even when the game's files stop loading, because the frame already has them.

Fix, in F's Task 22 (the beat route is F's): the beat route, or `recordBeat`, answers `over` when the session's game is not live or is no longer live on the session's pull. One case in `sessions.pg.test.ts` and one journey. `sessions.ts` is also in S's file map (Task 30's `startReviewPlay`), so this waits for S.

### S-5 (should fix; `docs/superpowers/progress.md`): the tracker's slice 2 rows are stale

- The overall table's slice 2 row still says "The first execution session … is on branch A, `slice-2/game` (pull request #44, a draft)" and 52% (16 of 31 tasks). Every branch through T is merged.
- Branch B's row says "in progress … draft pull request #47 … not marked ready until G1 is done". #47 is merged (`2b71f4b`), and G1 is ticked below the table.
- Branches A, C, D and E say "done, on its pull request"; each is merged (`e46a6ad`, `bc9b050`, `6fc66c2`, `ebeff87`).
- Branch S's row says Task 19 is "on its pull request (#78, a draft)"; #78 is merged (`79bc33e`).
- The stage list leaves "Plan audit" and "Plan audit of the rest" unticked, with "not done until merged"; #29 and #124 are merged.

Fix: those rows and boxes brought up to date, with the merge commits above. Docs only. It touches the same file every stage writes, so the fix session merges main in first.

### S-6 (should fix; in `service.ts`, branch S's file): a waiting game whose new files were refused stays in the queue with its older files

When a waiting game's maker chooses other files (or a new list of websites) and the new copy is refused, `pullLatest` throws before it can move `pendingPullId`, and `saveAnswer` has already kept the new repository, branch and folder. The game stays in staff's queue with the older pending pull, which may be from a repository the maker has moved away from, and `pullProblem` set. The maker's Waiting screen says so ("filesProblem"); nothing stops staff accepting the older files.

Fix: `accept` refuses while `pullProblem` is set ("Its maker is fixing its files. It comes back when they're fixed."), and the check page shows it, in S's Task 30. Or the waiting game leaves the queue until a copy passes. The first is smaller.

### L-1 (small; `pass.ts` or `cloudflare/games/worker.ts`): the gate with no pass secret answers Cloudflare's own error page

`requireSecret` refuses only `""`. On the gate an unset `PLAY_PASS_SECRET` is `undefined`, so `createHmac("sha256", undefined)` throws a `TypeError` on every game request, and the player sees Cloudflare's error page instead of a line of ours. This is exactly the state between deploying the gate and O-B's step that sets the secret.

Fix: the Worker treats a missing or empty `PLAY_PASS_SECRET` as unset and answers every game request with `plain(503, "Games aren't ready yet. Try again later.")`, or `requireSecret` takes `string | undefined`. A case in `games-worker.test.ts` or `gate.test.ts`.

### L-2 (small; tests only): the clip and photo key shapes are written twice, and no test ties the copies

`gate.ts` writes `CLIP_KEY` and `PHOTO_KEY` out by hand (so it imports no feature), beside `clips.ts`'s `CLIP_KEY` and `photo.ts`'s. M had to change both clip copies to add `.mov`. A new clip type added to `clips.ts` alone would be refused by the gate, and every test would still pass, since each side is tested against its own list.

Fix: one test in `tests/features/play/gate.test.ts` that makes a key with `clipKeyFor` for every clip type and every shape (and a photo key with the pages feature's maker of keys) and asks the gate for it. A test may import both sides.

### L-3 (small; `service.ts`, after S): two games given the same name at the same moment fail with "Something went wrong"

`freeSlug` reads which addresses are taken, then `game.create` writes one. Two makers who name a game the same at the same moment both get the same free address; the second `create` fails on the unique index and the maker sees the site's error page. (A public id collision would do the same, but at ten characters of 32 it does not happen.)

Fix: `startGame` (and the rename in `saveAnswer`) catch Prisma's unique failure on `slug` and try `freeSlug` once more. Waits for S, which edits `service.ts`.

### L-4 (small; `src/routes/make/[game]/[question=question]/+page.server.ts`): a video sent without a length is read whole before it is refused

The clip action refuses a request whose `content-length` is over 31 MB before reading it. A request with no `content-length` (sent in chunks) reads as 0 and passes, and `formData()` holds all of it in the Worker before `clipProblem` refuses it. Browsers always send a length for a form with a file, so only a hand-made request does this; Cloudflare's own limit on a request (100 MB on the Free and Pro plans, as the plan notes) still applies.

Fix: refuse a clip request with no `content-length` as too big, with the same words. One unit case if the route's check moves into a small function, else a note in the route's comment.

### O-1 (needs the Owner's choice): a game waiting for its first yes has no way out

A waiting game cannot be thrown away (only a draft or a sent-back game can) and cannot be taken off (only a live game can). A maker who sent a game by mistake, or changed their mind, waits until staff accept or send it back. The rest plan says this "is M's and is reported, not fixed here"; no answer from the Owner is recorded.

Options:

- a. **Leave it** until slice 4's admin portal, where staff can clear it. Recommended: it costs nothing now, and staff decide fast during the test.
- b. "Take it back" on Waiting: the game goes back to a draft and leaves the queue. One small screen and a service function.
- c. "Throw this game away" on Waiting too, as on a draft.

## Notes (no action unless the Owner says)

- **N-1. Built ahead of its user, by the plan's own order.** On main, nothing in `src/routes/` calls the play feature yet: `playServices`, `startPlay`, `recordBeat`, `playSummary`, `GAME_FRAME_*`, `isPhone` and `backFromPaywall` are used only by tests (and `countedMs` by the money slice). The plan builds branch P before F on purpose. Their users arrive with S (`playSummary` on the check page, `startReviewPlay`) and F (the play screen). The final audit checks each has one; if F or S drops one, it goes.
- **N-2. Words that say "can't undo" while the plan says it can be put back** are covered by S-2; the maker agreement's own point 1 ("You can take your game off Ruken yourself at any time") is consistent with both.
- **N-3. The agreement is asked only on Check and send.** `sendForReview` does not ask it, and a sent-back game's "Send again" and a live game's "Send a new version" do not either. The agreement's point 7 asks again "before your next game goes up", so updates to a game already agreed to need nothing more. Said so the next version of the agreement is planned with it.
- **N-4. `.mov` clips** (the Owner's "Yes, take .mov", not reopened). Said once, with the fact: a Mac or iPhone screen recording saved as `.mov` is often HEVC, which Chrome plays only where the device itself can decode it and Firefox mostly not at all, and some browsers will not play a file served as `video/quicktime` whatever is inside; the clip check reads only the file's first bytes, so such a clip is accepted and may show a blank frame on those screens. (Not tried here: no browser test plays a `.mov`.) G's real-site check (Task 24) is the place to look at one on an Android phone.
- **N-5. A game named only in Korean, Japanese or Chinese gets no address** (`slugOf` keeps a-z and 0-9) and is refused with "Pick a name with at least three letters or numbers." These are must-have languages for later; whoever plans translation needs this line.
- **N-6. Changing a game's websites copies its files from GitHub again,** twice over, because a copy's server list is fixed with the copy (`GamePull` is add-only). It is correct; it is slow for a big game. Noted for whoever measures FloorFifty's first copy.
- **N-7. Not yet measured: a copy near the limits inside a Worker.** The plan's numbers (30 s of CPU, 128 MB) were read, not tried; the largest copy measured is the journeys' tiny game (8.2 to 13.4 s a project, run 43702379831, most of it the journey). FloorFifty is 91 MB, read twice and unzipped twice. Task 24 should record how long its first copy took, and whether the Worker's CPU limit needs raising.
- **N-8. GitHub's tarball redirect.** `tarball()`'s comment says `fetch` leaves the token behind when it follows GitHub's redirect to the download host. That is what the Fetch standard says for a redirect to another origin; it was not checked in Workers' own `fetch`. Both hosts are GitHub's, so nothing leaves GitHub either way.
- **N-9. M's first migration is named earlier than six on main** (`20261114091000_review` sorts before `20261114120000_pages` … `20261114180000_final_month_lines`). `prisma migrate deploy` applies every migration it has not recorded, so the real database takes it; a new database replays it in name order, and it needs nothing from those six. Nothing to do; said so nobody is surprised by the order in `_prisma_migrations`.

## What is left for the final slice 2 audit

Branches S (Tasks 30, 31), F (Tasks 20 to 23) and G (Task 24), and checking that S-1, S-2, S-4 and S-6 were taken where this audit says, plus whatever M changes after `f6086e0`.
