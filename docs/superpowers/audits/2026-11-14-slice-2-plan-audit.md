# Slice 2 plan audit: games and play

Date: 2026-11-14. Stage 3 (plan audit), on branch `audit/slice-2-plan`.

What was audited: `docs/superpowers/plans/2026-11-13-slice-2-games-play.md` as merged in pull request #27. It was read against `CLAUDE.md`, `AGENTS.md`, the design (`docs/superpowers/specs/2026-11-13-ruken-reels-linktree-design.md`), slice 1's plan and its three audits, `docs/superpowers/progress.md`, and the code on `main` at `45ea388` (slice 1's branches A to D and G merged; L, E0, E, F and H not yet).

What was run, and what was not:

- No test of this repository was run (CLAUDE.md: tests run only on GitHub's runners). This audit is a reading of files.
- Wrangler 4.156.0, the version the plan pins, was installed in a scratch folder outside the repository. Its `--help` was read for `deploy`, `secret put` and `r2 bucket create`, and its own bundled code (`wrangler-dist/cli.js`) was read for how a deploy treats routes and how `secret put` reads a piped value. Nothing was deployed and nobody signed in.
- GitHub's and Cloudflare's pages were not fetched again in this session. Where a finding rests on GitHub's REST API, it names the endpoint. Task 24 checks each one on the real site.
- Nothing in this repository's code or CI was changed. The design was changed in two lines only, each on the coordinator's word (D3): 5.2's pass, and 5.4's line for the Owner's decision of 2026-11-14.

Counts: 3 block execution, 25 should fix, 20 notes. Every finding that blocks execution or should be fixed is fixed in the plan. Of the notes, 12 are fixed in the plan; 8 stay, each with its reason (N10, N11, N12, N13, N15, N18, N19, N20).

The coordinator's decision of 2026-11-14 is written into the plan, test first (D1, below). So is the note on the maker agreement's text (D2).

## Decisions written in

### D1. One play pass per member per game, for a day (coordinator, 2026-11-14)

The decision: a member gets one pass per game, and it stays the same for that member for 24 hours. The game's addresses then stay the same, and the browser keeps the 91 MB it downloaded. A pass is never shared between members. A leaked address can be traced to one member, and it stops working within a day. This replaces the four-hour pass made on every Play.

How the plan now has it:

- **Calls:** the pass carries a random id of its own (`i`). It still carries nothing about the person; only the new `PlayPass` table ties the id to an account.
- **Task 12:** `PASS_LIFE_MS` is 24 hours. A pass is handed out again while `PASS_MIN_LEFT_MS` (4 hours) is left. The plan adds `newPassId`, and `checkPass` checks the id's shape. New red cases cover the payload's five keys, the same pass from the same claims, the two times, and an id of the wrong shape.
- **Task 13:** the gate's `cache-control` is `private, max-age=<the pass's seconds left>`, so the browser keeps the files exactly as long as their address works.
- **Task 16:** a `PlayPass` table (add-only), and `PlaySession.passId`.
- **Task 18:** `passFor` in `play/passes.ts`; `startPlay` and `startReviewPlay` use it. New red cases:
  - the same member gets the same address for 20 hours, then a new one;
  - two members never share a pass;
  - new files get a new pass;
  - a lapsed member is refused and given no pass;
  - signed-out play of a free game shares one pass;
  - the pass row names the member.
- **Review Focus 21:** two members, two passes; one member twice, one pass.
- The FloorFifty "91 MB on every Play" item is closed, and the last note under "Notes for the plans that follow" is rewritten.

Two readings were mine. I asked the coordinator about both, with options (sent 2026-11-14), and the coordinator chose my recommended answer to each (D3):

1. "The same for 24 hours": read strictly, a Play late on the pass's last day could stop partway through. The plan gives a pass 24 hours of life and reuses it while 4 hours are left. So the address stays the same for 20 hours, every Play has at least 4 hours, and a leaked address stops within a day.
2. Signed-out play reaches only a free game. Those players share one pass per game and files. The game is free, so sharing gives nothing away, and launch-day visitors keep the files in their cache.

The decision's price, now in the plan: a member whose membership ends cannot start a Play, but an address already given keeps loading that game's files for up to a day. Design 5.2 calls the pass "short-lived". That word is the design's, so I reported it to the coordinator and did not change it.

### D2. The maker agreement's text (O5)

The Owner chose a short, plain, versioned text, now. The coordinator supplies the text and its version before branch M starts. The plan keeps its placeholder and now says so in O5, Task 26 (`MAKER_AGREEMENT_VERSION` is that version; the branch is not marked ready with the placeholder) and Task 28.

### D3. The coordinator's answers, and what came after them (2026-11-14)

- **Answers to D1's two questions:** (a) to both, as recommended. The plan now states them as the coordinator's answers. The coordinator also allowed one design change, made here: design 5.2 now says "a play pass that lasts a day (Call, 2026-11-14, coordinator)" where it said "a short-lived play pass".
- **The maker agreement's file:** the coordinator asked that the text be a file, read only by `make`. It is `src/features/make/library/maker-agreement-v1.txt`, version `"1"`. It is a `.txt` because nothing renders Markdown and the page shows plain paragraphs. It is imported with Vite's `?raw`, with no package added. Task 26 defines it, Task 28 shows it, and the file map and O5 say so. The coordinator supplies the text before branch M.
- **The pass in the game's own address:** the coordinator also asked that the plan check the pass from inside the game, since the game can read its own address. Task 21's "the game sees nothing about the player" journey now reads `location.pathname` inside the frame and checks that it holds neither the member's email nor their account id.
- **Owner, 2026-11-14: "They take games down themselves"** (with the maker agreement, version 1, which the Owner approved with this change):
  - The design's 5.4 has one line for it, marked "Owner, 2026-11-14". The plan has a new Call and a new task, Task 31 on branch S, after Accept, because its journey needs a live game.
  - The button: "Take it off Ruken", a quiet button on `/make/<game>`, with a confirm step in plain words.
  - At once: the game becomes `taken_off`, a new state, the maker's own and apart from staff's `taken_down`. It leaves its page, and the feed once slice 3 builds it. Any update waiting for review is dropped.
  - Its files are deleted from the bucket, so every pass for it loads nothing more. Its clips are kept.
  - Each step is recorded with who and when, in a new add-only table, `MakerAction`.
  - "Put it back" pulls the files again and sends the game for review. It does not go straight back live, for two reasons: its files are gone and must be pulled fresh, and a person should check them before they are live again (design 5.5). Otherwise a maker could take a game off and put it back to slip an unchecked change past staff.
  - New: Review Focus 25, and a red-then-green journey that loads a member's frame address after the game is taken off and gets 404.
  - Stays, as a note: a browser that already holds some of the game's files can keep using its copy until its pass runs out. The gate stops serving, but it cannot reach into a browser's cache.

## Findings

Severity is one of: **blocks execution** (a task cannot be done or proved as written), **should fix** (wrong, unsafe or inconsistent, but a careful executor might get around it), **note**.

### Blocks execution

**B1. A person could pick a private repository they cannot open.**
- Where: Task 15 (`repositoriesOf`, `repositoriesFor`); Task 27.
- What was wrong: the repository list came from `GET /installation/repositories`, asked with the installation's token. That lists every repository the installation holds, whoever asks. In an organisation's installation, a member who can reach one repository would be offered the others, private ones included. Ruken would then copy one and serve it. The check in `createGame` and `pullLatest` asked only whether the repository's installation was one the person can reach, not whether the person can reach that repository. The coordinator's brief requires "only repositories GitHub says the person can reach".
- Fixed:
  - At the moment of connecting, with the person's own token, Ruken asks `GET /user/installations/{id}/repositories`, which lists only what that person can reach, and stores the list.
  - The new `GitHubRepository` table holds it, and `repositoriesFor` reads it. `createGame` and `pullLatest` require the repository to be on the person's list, and `installationOf(repo)` must still be that row's installation.
  - The person's token is still used only at that moment and never stored. Connecting again refreshes the list.
  - New: "Found while planning" item 10, and Review Focus 23.
  - Tests: Task 15's `connection.pg.test.ts` and `github-connect.test.ts` cases. Task 25's stand-in GitHub holds a third repository, `ruken-test/not-yours`, that is never listed for the person. Task 27 has a journey that types it by hand.

**B2. A refused pull's words were kept nowhere.**
- Where: Tasks 1, 10, 28.
- What was wrong: Task 28 says "when the last pull was refused, the Game files line reads the refusal itself". Its journey (`broken-game`, no `index.html`) checks those words on the game's page after a redirect. But a refused pull stores nothing: no `GamePull` row and no column. The words could not reach that page, and the executor would have to invent the storage.
- Fixed: `Game.pullProblem?` (Task 1). `pullGame` sets it before it throws and clears it when a pull passes (Task 10). Task 10 has two new red assertions, and Task 28 reads the column.

**B3. The journeys' first beat would be refused as "too soon".**
- Where: Task 18 (`recordBeat`); Task 22's journeys.
- What was wrong: a beat was "too soon" when it came less than 5 seconds after the session's latest beat or its start. The journeys move the page's timers with `page.clock.runFor(16_000)`, but the server stamps with the real clock. The first beat therefore reaches the server a moment after the session started and would get 429. "A member's play time is recorded against that game" (design 8) and its sibling journeys could not pass.
- Fixed: a session's first beat is never too soon. It adds no time the server's clock did not see (`countedMs` still caps it by real time). The Task 18 case is now "takes the first beat at once, and drops one that comes too soon after the last". New: Review Focus 24.

### Should fix

**S1. The play-start limit had the wrong shape.**
- Where: Task 18.
- What was wrong: `PLAY_STARTS_PER_ADDRESS` was `{ limit: 30, windowSeconds: 60 }`. Slice 1's `RateLimitRule` on `main` is `{ max, windowMs }`, and its keys start with `api:` (`src/lib/server/rate-limit.ts`, `service.ts`'s `api:checkout-start:`).
- Fixed: `{ max: 30, windowMs: 60_000 }`, key `api:play-start:<address>`. The "relies on" table states the shape.

**S2. `showTheOwner` was called with two arguments.**
- Where: Tasks 20, 21, 27, 28, 30.
- What was wrong: slice 1 defines `showTheOwner(page, testInfo, screen)` (its Task 37). Every call in this plan left out `testInfo`, which would fail typecheck.
- Fixed: every call and its test's parameters.

**S3. The error page cannot show the 429 words.**
- Where: Task 21.
- What was wrong: Task 21 sent `{ refused: "busy" }` to "the error page with 429 and 'You've opened a lot of games just now…'". The error page on `main` shows its own two lines and never the error's text, so a 429 would read "Something went wrong on our side."
- Fixed: Task 21 gives `+error.svelte` a 429 branch with those words and its "Back to Ruken", with a journey case. Added to the file map.

**S4. The new-game form's `<select>` and `<textarea>` had no look.**
- Where: Task 27.
- What was wrong: slice 1's look styles `input`, not `select` or `textarea`. The repository list and "Game servers" would sit on the card unstyled. Branch M comes before branch S, so nothing earlier would give them a rule.
- Fixed: Task 27 gives both the field rule `input` has (an element rule, no new class), with a `look.test.ts` case.

**S5. A suffixed slug could break the 40-character limit.**
- Where: Task 11.
- What was wrong: `slugOf` cuts at 40 characters, and a taken slug then gets `-2` … `-9`. A 40-character slug plus `-2` is 42, which Task 1's CHECK refuses: the insert would fail with a database error, not the plan's words.
- Fixed: the base is cut to 38 characters, with any hyphen at its end dropped, before a suffix is added. Task 11 has a case.

**S6. The real `/make` would break between branch E's merge and G3.**
- Where: the Owner's steps; branches C and E.
- What was wrong: `gamesServices()` will not start without `GAME_ADDRESS_PATTERN`, which only G3 sets. G3 was "needed for G4" and G2 "before branch E merges". Once E was on `main`, every maker's screen on the real site would answer "Something went wrong" until G3.
- Fixed: G2 and G3 are both needed before branch E is marked ready, and branch D's first line says so.

**S7. A deleted account kept its GitHub connection.**
- Where: Task 15.
- What was wrong: slice 1's Task 20 says each later slice that adds a person's data adds its removal to `purgeDueAccounts`, with a test. The GitHub rows hold a person's GitHub login and repository names, and nothing removed them.
- Fixed: the purge deletes the person's `GitHubInstallation` rows (their repositories cascade), with a `purge.pg.test.ts` case. The plan says why `MakerAgreement` (a record of what was agreed) and the play rows (money facts that keep an account id, as slice 1's payment rows do) stay.

**S8. A live game's clip could change with no review.**
- Where: Tasks 26 and 28.
- What was wrong: `GameClip` is one row per shape, and the live game uses it. A maker could replace a live game's clip, and it would be live at once, with no person's yes. Task 26 also named "the two pending clip keys", which no table holds.
- Fixed: `saveClip` refuses on a live game with "A live game's clips can't be changed yet.", and the game's page shows no Upload for a live game. `gameForReview` answers "the two clip keys". Slice 4 brings changing clips through review (Calls, "A live game's update").

**S9. Pulling again while waiting left staff reviewing the old files.**
- Where: Task 26.
- What was wrong: `sendForReview` pins `pendingPullId`. A maker who pulled again while waiting would leave staff reviewing the older files, with nothing to tell them.
- Fixed: `pullLatest` on a game with a pending pull puts the new pull in its place, with a case.

**S10. The waiting list's "sent" time had no column.**
- Where: Task 26.
- What was wrong: `waitingGames` answers `sentAt`, and the list is "oldest first", but nothing records when a game was sent. The pull's own time comes earlier, before the clips.
- Fixed: `Game.pendingSince?`, set by `sendForReview` and by S9's replacement.

**S11. Staff review play did not say where its servers come from.**
- Where: Task 30 (`startReviewPlay`).
- What was wrong: the pass needs the servers of the pull being reviewed, and the input had none.
- Fixed: it reads the pull's own `connectHosts` from its row, with a case.

**S12. Who plays free as staff did not match who opens the staff pages.**
- Where: Tasks 21, 29, 30.
- What was wrong: Task 21 made anyone with any staff role (`finance` and `support` included) a staff player, who plays free. `staffOnly` took its role list as an argument.
- Fixed: `GAME_STAFF_ROLES` (`owner`, `head_curator`, `curator`) in `accounts/staff.ts`, used by both, as a Call the Owner can overrule. Both read the roles from `caller.staffRoles`, which `main`'s `Caller` already carries (also N14).

**S13. A 50 MB file could take twice its size in memory.**
- Where: Task 9.
- What was wrong: `bytes(limit)` did not say how it gathers a file. Gathering pieces and joining them at the end holds a 50 MB file twice, about 100 MB, inside a 128 MB Worker that also holds the app.
- Fixed: one `Uint8Array` of exactly `size` bytes is made first and filled in place, with a comment that says why, and a case for a header split across two chunks.

**S14. The gate blocked addresses made inside the browser.**
- Where: Task 13 and the Calls.
- What was wrong: the gate's `connect-src 'self' …` also refused `blob:` and `data:` addresses. Game engines use them to read their own sounds and pictures, so a game could fail with no fault of its own. They are not servers.
- Fixed: `connect-src 'self' blob: data: …`, in the Calls and in Task 13's exact header test.

**S15. A service worker could outlive the pass.**
- Where: Task 13 and the Calls.
- What was wrong: with `allow-scripts allow-same-origin`, a game can install a service worker on its own address. That worker could go on serving the game's files after the pass runs out, which breaks "without a pass the files do not load".
- Fixed: the gate answers 403 to a request that carries `service-worker: script`, before it reads the pass, with a case. New: Review Focus 22, and a Call that says why.

**S16. The gate's cache time was fixed at four hours.**
- Where: Task 13.
- What was wrong: `max-age=14400` did not follow a pass's real life. Under D1 it would throw away a day-long pass's files after four hours. It could also let a browser keep files past their pass.
- Fixed: `max-age` is the pass's seconds left, with a case.

**S17. A long pull gave no sign that anything was happening (drunk-grandma test).**
- Where: Tasks 27 and 28.
- What was wrong: "Next: add your clips" and "Pull the latest" copy FloorFifty's 91 MB twice inside the press, which can take a minute with nothing moving.
- Fixed: one `note` under each: "Copying your game can take a minute. Keep this page open."

**S18. One problem had two sentences.**
- Where: Tasks 8 and 15.
- What was wrong: "Ruken can't see that repository." ended "Install the Ruken app on it in GitHub, then try again." in one place and "Choose it on GitHub, then try again." in the other. A maker could meet both on one form.
- Fixed: one sentence, the second.

**S19. `Invoke-WebRequest` may fail on the Owner's Windows PowerShell 5.1.**
- Where: G3 step 6; Task 24 step 1.
- What was wrong: without `-UseBasicParsing`, PowerShell 5.1 can stop for Internet Explorer's engine.
- Fixed: both commands have `-UseBasicParsing`, which PowerShell 7 also accepts.

**S20. Two journey helpers were named but never defined.**
- Where: Task 30.
- What was wrong: `submitGame` and `signInAsStaff` were in the file map and Task 30's journey, but nothing said what they do or answer. Granting the role had no named helper.
- Fixed: both are defined beside `addGame`; `grantStaffRole(email, role)` goes in `tests/browser/support/database.ts`.

**S21. The "membership ended" journey leaned on a step the stand-in Stripe cannot do.**
- Where: Task 21, Review Focus 8.
- What was wrong: the first way the plan offered was "cancel now at the stand-in". Slice 1's stand-in Stripe ends a membership only at the period's end (its portal) or with the account.
- Fixed: the journey sets the row to `ended` through `endMembershipOf(email)`. Slice 1's one membership rule (`access.ts`) reads `ended` as not a member.

**S22. The maker agreement's page had no look and no check.**
- Where: Task 28.
- What was wrong: `/legal/maker-agreement` is one of Ruken's own screens, but the plan named no classes for it and no journey reached it.
- Fixed: `<main class="card">`, a heading, a version `note` and paragraphs. It needs no account, so it is added to `CARD_SCREENS`.

**S23. The GitHub tables were in the wrong feature's schema file.**
- Where: Task 15 and the file map.
- What was wrong: `GitHubInstallation` was in `make.prisma`, but the games service reads and writes it. CLAUDE.md: "A feature owns its code and its data".
- Fixed: it and `GitHubRepository` are in `games.prisma`; `make.prisma` holds `MakerAgreement` only. `GameReview` is in `games.prisma` too.

**S24. The GitHub state's secret was unnamed.**
- Where: Task 15.
- What was wrong: `sealState` and `openState` took "a secret" with no source.
- Fixed: `BETTER_AUTH_SECRET`, the app's own, as for the arrival cookie. Never `PLAY_PASS_SECRET`, which the gate holds too.

**S25. Three of the look's classes would have been built ahead of their screen.**
- Where: Task 19 (branch S) and Task 21 (branch F).
- What was wrong: Task 19 added `stage`, `bar` and `back` to `look.css` and `CLASSES` on branch S, but their only screen is Task 21's, on branch F. They would have sat on `main` unused, against CLAUDE.md ("Build nothing ahead of its user") and slice 1's look rule (a class arrives with its first use). Task 19 also offered keeping a test red until a later branch, which would have put a failing test on `main`. Slice 1's plan has no "every class is used" check, so that red case would not in fact arise.
- Fixed: Task 19 adds `clip` and `frame`, both used by Task 30 on the same branch. Task 21 adds `stage`, `bar` and `back` with the play screen, with their contrast and size cases. `frame` gets a rule of its own (70% of the window's height) and a second rule inside `stage`, so the staff page needs no box of its own. The Global Constraints, the branch table and the file map now say so.

### Notes

**N1. The add-only trigger takes the table's name.**
- Where: Tasks 1, 16, 26.
- `reject_append_only_change` on `main` takes the table's name as its argument, as the membership migration attaches it.
- Fixed: the "relies on" table shows the exact statement, and each table names its own.

**N2. The gate's start-up wait and the server count were inconsistent.**
- Where: Tasks 14 and 25.
- The gate's start-up wait (170 s) was shorter than the app's own 180 s start limit. The servers were also called "the fourth" in Task 14 and "the third" in Task 25.
- Fixed: the wait matches the app's limit, and the servers are named instead of numbered.

**N3. What Wrangler 4.156.0's own code shows.**
- Where: the Owner's steps and Task 24.
- A deploy publishes routes only when the config or `--route` names some. So the route the Owner adds should outlive Workers Builds' deploys, which name none.
- `deploy --route` exists. `secret put` trims what it is piped and makes a draft Worker when none exists. `r2 bucket create <name>` is as written.
- Written in as "Found while planning" item 9. Task 24 step 1 still checks the route on the real site.

**N4. "No command can change DNS" was not quite true.**
- Where: G3 step 1.
- Cloudflare's API can change DNS, but it needs a token that is itself made on the website.
- Fixed: the step says why the dashboard is the shorter way.

**N5. The GitHub App's name may be taken.**
- Where: G2 step 1.
- GitHub App names are unique across GitHub, so "Ruken" may already be taken.
- Fixed: the step says to add a word, and the short name follows.

**N6. `sendBeacon` sends its body as `text/plain`.**
- Where: Task 22.
- Fixed: the beat route reads the body as text and parses it as JSON, whatever its type.

**N7. Whether GitHub comes back after a repository change is not settled by reading.**
- Where: Tasks 25 and 24.
- Unsettled: whether GitHub returns to the site after a maker changes which repositories an existing installation may read.
- Fixed: Task 24 step 2 checks it once, and records the answer. "Connect GitHub" again refreshes the list either way.

**N8. Some games will not run in the frame.**
- Where: the Calls; Task 24 step 4.
- The frame leaves out orientation lock, and nothing makes a game "cross-origin isolated", which some engines' threaded builds need. Those games will not run.
- Fixed: the Calls and `frame.test.ts` say so. Task 24 reports such a console line rather than working around it.

**N9. The tarball holds the whole commit, not just the folder.**
- Where: Task 10.
- A repository whose other folders are big is downloaded whole, twice.
- Fixed: written beside step 2, with O3's ready branch as the answer.

**N10. The cap numbers check out.**
- Where: Task 4.
- 91,441,454 × 4 = 365,765,816, rounded up to 400,000,000. 326 × 4 = 1,304, rounded up to 1,500. 10,680,799 × 4 = 42,723,196, rounded up to 50,000,000.
- Against Workers Paid as the plan cites it:
  - 1,500 R2 puts and a handful of GitHub calls are far under 10,000 subrequests.
  - Two gunzips of about 91 MB run in the runtime's own code, well inside 30 s of CPU.
  - One file at a time, filled in place (S13), keeps a 50 MB file at about 50 MB of 128 MB.
  - A 31 MB clip request is under the 100 MB request body limit.
  - A pull has no duration limit while the maker's page stays connected.
- Stays as written. Task 24 step 4 is the stop rule if the real site says otherwise.

**N11. "Tap ← to go back to the feed" points at a page that is not yet the feed.**
- Where: Task 21.
- Until slice 3, ← lands on the game's own page, not the feed.
- Stays: these are design 5.7's words. They become true when slice 3 makes `/g/<game>` the feed opened at that clip, which is before launch.

**N12. A game can tell two Plays on one day came from the same browser.**
- Where: D1.
- Under D1, the game sees the same pass in its address for both.
- Stays: the game could already tell, from the saves it keeps on its own address. Written into the Calls.

**N13. The first-owner journey mostly proves the 404 and the 409.**
- Where: Task 29.
- In the shared journeys' database, a staff row usually exists before this journey runs.
- Stays: `staff.pg.test.ts` proves the grant itself. The report line says which ran.

**N14. `Caller` already carries `staffRoles`.**
- Where: Task 21.
- `Caller` on `main` holds `staffRoles`, read fresh on every request.
- Fixed with S12: Task 21 reads them from the caller instead of calling `staffRolesOf` again.

**N15. A pass outlives a lapsed membership for up to a day.**
- Where: D1.
- A member whose membership ends can still load that game's files from an address already given, for up to a day.
- Stays: it is the decision's price. Written into the Calls and the slice 4 note.

**N16. The change-branch and server fields open with no script.**
- Where: Task 27.
- Fixed: "Change the branch or folder" and "My game talks to a server" are `<details>` with their `<summary>`.

**N17. "Not now" may be written in the page, not its server file.**
- Where: Task 21.
- Fixed: `+page.svelte` is listed too, if the link's address is written there.

**N18. A deleted maker's live games stay live.**
- Where: Notes for later slices.
- Stays for slice 4. Written under "Worth the Owner's eye", with a sweep of old `PlayPass` rows.

**N19. Pulling the same commit twice makes a second, identical pull.**
- Where: Task 10.
- Stays: it is harmless, and the files are separate. Slice 4 already owns deleting old pulls.

**N20. Only `index.html` is checked for addresses that start at the top of the site.**
- Where: Task 4.
- A script or stylesheet that asks for `/x` is refused by the gate (403); it is not caught at the pull.
- Stays: the pass still covers every file, so nothing loads without one. Written under "Worth the Owner's eye" as a later check.

## What was checked and found right

- **Slice 1 pieces on `main`, by name and signature:**
  - `requireEnv`, `optionalEnv`, `Clock`, `systemClock`, `chicagoDayOf`, `TestClock`, `createRateLimiter` (shape: S1), `startTestDatabase`;
  - `Caller`, `signedInOnly`, `staffRolesOf`, `StaffRole`'s six values, `authServices`;
  - `membershipServices().service.isMember(userId)` and `.arrival.remember(cookies, { makerUserId, path })` (in `membership/services.ts`, with the `rk_arrival` cookie, `httpOnly`, `SameSite=Lax`);
  - `MembershipStart.broughtByUserId` and `arrivalPath`;
  - `reject_append_only_change` (N1), `forgetRateLimits`, `+error.svelte` (S3), `/healthz`.
- **Pieces from branches not yet merged, each in slice 1's plan as this plan names it:**
  - `platform()`, `setPlatform`, `src/lib/server/cloudflare.ts`, `databasePerRequest`, `wrangler.jsonc`, `pnpm generate` with `wrangler types` (Tasks 33, 34);
  - the `deploy` script (Task 16);
  - `JOBS_SECRET` and `/jobs/purge-accounts` (Task 20);
  - `/join?next=`, "Not now", "Join Ruken to play", the stand-in Stripe, `payAsNewMember`, `signUpInItsOwnContext`, `userIdOf`, `membershipStartsOf`, `arrivalCookie` (Tasks 27, 29);
  - `look.css`, `CLASSES`, `expectOneCard`, `pipRed`, `CARD_SCREENS` and `showTheOwner` (Task 37; S2).
- **The game gate:**
  - a separate Worker and R2 bucket;
  - one origin per game, `g-<id>.GAMES-DOMAIN`, and clips on `media.`;
  - the sandbox `allow-scripts allow-same-origin allow-pointer-lock`;
  - the `allow` list `gamepad; fullscreen; autoplay; clipboard-write; web-share`, with `referrerpolicy="no-referrer"`;
  - `frame-ancestors` set to Ruken's site only;
  - a per-game `connect-src` for the maker's listed servers (S14);
  - a pass in every file's address, checked on every request before the bucket is asked, with service workers refused (S15);
  - no cookie, set or read;
  - `referrer-policy: no-referrer`, so a pass never travels to a game's server.
- **Play time:**
  - a beat every 15 seconds and at most 45 seconds counted per beat, by the server's clock;
  - time counts only while the tab shows, the frame is on screen and the frame has focus;
  - nothing counts before the first tap;
  - free, staff and own-game play are recorded with their basis and never counted for pay.
- **Staff Accept and Send back:** both sit behind slice 1's staff roles (S12), with one `GameReview` row per decision.
- **The drunk-grandma test:** every screen's words were read aloud. Fixes: S3, S17, S18, the live-clip line (S8) and N11.
- **The Card Table look on Ruken's own screens:** one card and one filled button per card, no red anywhere in this slice, and tokens only. Fixes: S2, S4, S22, S25.
- **The Owner's steps G1 to G4:** each is one line for Windows PowerShell, with a website only where no command exists (N4). They were checked against Wrangler 4.156.0's `--help` and code (N3) and against PowerShell 5.1 (S19).

## Reported to the coordinator, not changed here

- Two questions on the reading of D1, sent 2026-11-14 with a recommended answer to each. Answered (a) and (a) (D3).
- Design 5.2's "a short-lived play pass" read oddly against a pass that lasts a day. The coordinator allowed the change, and it is made (D3).
