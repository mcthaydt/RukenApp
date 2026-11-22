# Implementation audit 1: slice 3 unit K, social icons on a maker's page

**8a38998 PASS** (0 red, 4 notes)

- Examined: `claude/project-thread-1jxbgo` at 8a38998 (51d6348 plus a clean merge of main c556cc0), against `docs/superpowers/specs/2026-11-21-feed-and-makers-page-design.md` unit K (K1 to K6, tasks 1 to 3) and the slice quality bar (section 7).
- Lane 3: `prisma/migrations/`, plus lane 2 paths (`src/features/pages/`, `prisma/schema/`, `tests/browser/support/`). Reviewer: Opus 5.5, medium, a fresh session that built none of it.
- Audit prompt: "Audit all of your work for completeness, consistency, cohesion, and harmony, both within itself and relative to the spec and relative to the codebase. Assume nothing. Verify everything. Investigate any incomplete implementations or incomplete integrations. Do your best work."

## What ran here, at 8a38998

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | 129 files, 1914 tests passed |
| `pnpm test:pg` (Postgres 16 in the container) | 49 files, 729 tests passed |
| `pnpm test:browser tests/browser/edit-page.test.ts tests/browser/maker-page.test.ts --project=tablet --project=computer` | 36 passed (1.8m), including both new journeys on both sizes |
| Phone (WebKit) | **Not run**: the container has Chromium only, and there is no pull request yet, so CI has not run on any commit of this branch (check runs on 8a38998 and 51d6348: 0). The phone pieces must be green in CI before merge. |

## Against the spec

- **K1, the marks and their record: met, re-measured.** I downloaded `simple-icons-16.38.1.tgz` from the tarball address in `social-icons-source.json`. Its sha512 is `q4JnGp1c...zl3N0g==`, the same as the recorded integrity. The package's `package.json` says `"license": "CC0-1.0"`, and its `LICENSE.md` matches `social-icons-LICENSE.txt` byte for byte (after line ends). Each of the ten paths in `social-icons.json` equals the `d` of `package/icons/<id>.svg`; for `itchio` the file is `itchdotio.svg`, as the record says. `simple-icons` is in neither `package.json` nor `pnpm-lock.yaml`. `tests/features/pages/social-icons.test.ts` holds the keys, the path characters, the licence, the record and the no-dependency rule.
- **K2, `SOCIAL_SITES` and `socialSiteOf`: met.** The ten sites match on an exact host or a subdomain (`host === known || host.endsWith("." + known)`), and the unit tests refuse `notyoutube.com`, `youtube.com.evil.example`, `evilitch.io`, a path that mentions a site, and a bad address.
- **K3, the migration: met, and safe.** `20261122160000_social_links/migration.sql` is one statement, `ALTER TYPE "PageLinkKind" ADD VALUE 'social'`, and sorts after the last migration (`20261121160000_live_held_changes`). Both checks exist and pass on the migrated database: `enum_range` gives exactly `link, game_elsewhere, social`, and the file's statements, comments aside, are that one. On Postgres 16 (Neon), `ADD VALUE` is allowed inside a transaction block since Postgres 12; the only limit is that the new value cannot be used in the same transaction, and nothing in this migration uses it. It rewrites no table, takes only a short lock on the type, and no `CHECK` constraint or other migration reads `PageLinkKind` (`grep` over `prisma/migrations/`). It rolls forward cleanly; see note N1 for going back.
- **K4, the service: met.** `checkSocial` runs in both `addLink` and `updateLink`, after `cleanLinkUrl`, so a change of kind or address is held to the same rule. The refusal says exactly "We don't have an icon for that site yet. Add it as a link." `pageByHandle` returns `social: { id, name } | null`, and the existing visitor-page test's key list gains `social`, the one changed assertion, which this change explains.
- **K5, the page's row: met.** Social links leave "Links" and sit after it in `<nav aria-label="Elsewhere">`; each is a 48 by 48 round link named for its site (`aria-label`, the svg `aria-hidden`), through `/<handle>/out/<id>`, in the page's button colours, with a visible focus ring. The journey measures the size, the radius, the colours, the order, the `href`, the `rel` and the 303 to the stored address.
- **K6, the room's choice: met.** The first question of adding and of changing a link is now one pick of three (`Picks` as radios): "A plain link", "A game somewhere else", "A small icon, for YouTube, Discord and the like". The kind rides to the second question in the address and the form, and `linkKindOf` turns anything else into a plain link, so no other value reaches the database. The changed edit-page step (checkbox to radios) is explained by this choice.
- **Plan ticks:** tasks 1 to 3 of unit K are ticked, and each is backed by the files and tests above.

## Safety

- A visitor is only ever sent through `/<handle>/out/<id>`. The address there is read from the database and refused unless it starts with `https://` (`[handle=handle]/out/[link]/+server.ts`), and the database holds the same rule. No address a maker typed is ever put in an `href`, so a `javascript:` address cannot reach a page; `linkProblem` already refuses anything but `https://`.
- `rel="nofollow ugc noopener"` matches the plain links. The svg is drawn from a fixed file keyed by our own site id, never from what a maker typed.
- Another maker's links: the existing journey "nobody changes another maker's links" still passes; `updateLink` keeps its `page: { userId }` guard.

## CRUD

"a maker adds a small icon, changes it, hides it and takes it off" (`tests/browser/edit-page.test.ts:333`) creates an icon (with a refused site first, and the typed address kept), reads it on the page as "YouTube", changes its words and address (refused again, then Discord), changes it into a plain link and back, hides it, shows it and removes it, reading the public page after each. Passed on tablet and computer here; phone is CI only.

## Owner rules

- Everything editable: a social link's words, kind, address, place, hidden state and existence can all be changed by the maker.
- Frosted glass: the change adds no see-through surface.
- No browser defaults: the choice uses the shared `Picks` cards; the icons are our own round links.
- Spinners: no new kind of wait. Both questions are plain forms, so `busy-forms` gives their button its spinner, and `tests/loading-states.test.ts` passed in the unit run.

## Red

None.

## Notes (not fixed here)

- **N1. Going back after makers add icons.** UNIT: deploy. VERDICT: note. REASON: an enum value cannot be dropped simply, and code from before this change does not know `social`, so reverting the code alone after a maker saves an icon would make that maker's page fail to read. EVIDENCE: Prisma maps the column to a fixed set of values. EXPECTED: roll forward; if a revert is ever needed, first run `UPDATE "PageLink" SET "kind" = 'link' WHERE "kind" = 'social';`, then revert the code and leave the value in the type. FIX: none now; the builder may name this in the pull request body.
- **N2. Brand marks.** UNIT: `src/features/pages/library/`. VERDICT: note. REASON: CC0 covers the drawings, not the brands; the package ships `DISCLAIMER.md` saying each mark stays its owner's trademark. EXPECTED: icons used only to point at the maker's own account on that site, which is how they are used. FIX: none.
- **N3. The name of an icon link is never shown to visitors.** UNIT: `src/routes/make/page/links/add/+page.svelte`. VERDICT: note. REASON: a maker is asked "What should the link say?" for an icon whose visitor-facing name is the site's ("YouTube"). The spec asks for this (K5), and the maker sees the name in "Your links". Worth a look at the owner's walk.
- **N4. A comment is now slightly off.** UNIT: `src/routes/make/parts/Picks.svelte` header. VERDICT: note. REASON: it says "Nothing is chosen for the maker", while the add question now starts on "A plain link". Starting on the plain link is right; only the comment lags.

## Before merge

The pull request does not exist yet. It needs its body to record the three commits, the visual check and the verify run, and green CI including the phone (WebKit) pieces. A push that changes what this audit covered makes it stale; a clean merge of main does not.
