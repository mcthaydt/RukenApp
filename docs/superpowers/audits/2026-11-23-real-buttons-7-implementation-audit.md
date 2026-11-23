# Real buttons: implementation audit, round 7 (fresh lane 2 review of the rework)

- PR: #345
- Head examined: `00abe4e887f34813ab689c3815c1ebe5b6255572` (3fef399: side links are blue → links and Your account is rearranged; 00abe4e: a Member / Not a member badge and What we keep a rem under the cookie buttons). Main `8cfacf3` is already in it.
- Reviewer: fresh lane 2 review, Opus 5.5, medium
- Date: 2026-11-23 22:16 UTC
- Verdict: **PASS** (0 red, 5 notes)

Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work.

## Against the owner's rules (2026-11-23)

The owner's rules: "Not everything needs to be a button, just not underlined plain text"; "Primary actions are buttons, but secondary actions are the -> buttons"; "What we keep in blue text with the ->"; Your account "is ugly, arrange this better"; "beside the number ... a green or red badge"; "use consistent spacing and margin, the what we keep is too close to buttons".

- **Primary actions are buttons.** Join Ruken (blue), Sign out and Delete my account (quiet), I agree and Not now, Add a link, Add a game, Text me a code, and the Back and Close icons are all still painted buttons. Pass.
- **Side links are blue → links (`.go`).** What is Ruken? (sign-in, You, join, help), What we keep (cookie notice, the cookies page), How the feed works (help, privacy, terms), Read the terms and Read what we keep (privacy, terms, how the feed works), Read the maker agreement, Forgot your password?, Create an account, Sign in on sign-up, the help guides' "on this page" and device lists, Here's how, the folder and GitHub how-tos, How to make it smaller, Your games / Change password / Your computers on You, and Your page / Maker agreement / Help for makers on Your games. On a card they are `--pay`; on the felt and on glass they are `--pay-light`. Each is at least 44px tall. Pass.
- **Nothing underlined.** `grep underline src` finds comments only. The journey's sweep passes on every screen it visits. Pass.
- **The landing page's `.more` links** are back to blue (on a card) or chalk words with an arrow. That matches the new rule. Pass.
- **Your account.** Shot on computer and tablet. In order: the number with its badge, the one membership button, four stacked → links, Sign out, then Delete. Measured gaps: 24 under the title, 16 to Join, 32 to the links, the links back to back on 48px lines, 32 to Sign out, 32 to Delete. That is one calm rhythm. **Is it exciting?** No, it is quiet. It is an account page with one coloured button and one coloured badge, which suits it. **Is it clean?** Yes: one main action, the side links are grouped, and the two "leave" actions sit at the foot with a full line of air between them. Pass.
- **Badge.** It sits on the number's line (the journey checks the middles match within 2px). Green `--felt-raised` says Member and red `--pip` says Not a member, both with white words. When the badge says Not a member, "You're not a member." is no longer printed. A member's renew or end line still shows. The unit test allows exactly two uses of `--pip`. Pass.
- **Cookie spacing.** On the cookies page's card: 16px from "No ads" to the buttons, and 16px from the buttons to the What we keep line. On the glass notice the journey checks that the gap over the buttons and the gap under them match within 4px. Pass.

## Checks run

In the cloud container on a fresh Postgres 16 database, at 00abe4e:

| Check | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 (2,224 files, 0 errors), after clearing a stale local `.svelte-kit` build |
| `pnpm test` | 2,174 passed |
| Journeys real-buttons, look, look-layout, membership, rejoin, buttons, make-walk, cookie-consent, me, about, glass, on computer and tablet | 318 passed, 0 failed (3.5 min) |
| Glass contrast of the notice's What we keep (a probe, not committed) | halo 7.1:1 over a clip and 5.8:1 over an all-white clip; the repo's glass bar is 4.5:1 |
| CI quick run at 00abe4e | verify, postgres, pr-rules-run and commit-authors: success. browser shard 6: `rejoin.test.ts:16` [phone] timed out clicking "Text me a code" (`support/account.ts:116`). That is the known sign-up text-code flake (progress.md, Flaky tests). The fail-fast stop interrupted `look-layout.test.ts:85` [phone] and cancelled the other shards. |
| PR body | attribution lines first, `## Lane` and `## Acceptance criteria` present, last line "Requested by **McThayDT**" |

Not run: phone (WebKit). There is no Docker daemon in this container. The phone results for the new badge layout (`look-layout:85`) and for rejoin come from the CI re-run.

## Notes (not blocking)

1. **The maker bar's "Your account" and "Finish later"** (`src/routes/make/+layout.svelte:67`) are still `.quiet` buttons. They are the screen's way out, so a button fits the rule as written ("the screen's way on"). The owner may see "Your account" as a side link.
2. **The "Back to …" links** (privacy, terms, help, the maker agreement, the account sub-pages) stay `.quiet` buttons. The repo rule lists Back as a button, so this is consistent.
3. **On glass over a bright clip,** the light-blue What we keep is visibly fainter than the white words. It still clears the repo's 4.5:1 halo bar. The rest of the notice dims the same way over white, and that comes from the glass design.
4. **`feed-controls.test.ts:832` [phone] failed at 2126888**, in the full run, shard 3: the first clip after the spinner was not current within 15s. This PR touches no feed code and main passes, so it belongs under "Flaky tests" in progress.md.
5. **The shared `.ways` name** (the global row and `/about`'s `nav.ways`) is unchanged from round 4. A later rename would remove the overlap.
