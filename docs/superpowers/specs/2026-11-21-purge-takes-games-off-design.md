# A deleted maker's games come off Ruken

- Status: plan, for its plan audit. Lane 3 (the coordinator's call, 2026-11-21 14:48 UTC: the daily job permanently deletes real makers' files and videos).
- Brief: the owner's decision on a card, 2026-11-21 14:26 UTC: "Games come off with the account." The CRUD audit (#267, finding 3) found that `purgeDueAccounts` leaves a deleted maker's games live and playable.
- Where: pull request #268, branch `claude/project-thread-vhfmo8`. The rest of #268 (journeys and the stand-in Stripe) is lane 1 and 2 and is not part of this plan.

## What changes

When the daily job finishes a deletion (14 days after the person asked), it now also deals with every game that person made. Nothing changes during the 14 days, so a maker who signs in again loses nothing.

| A game that is | becomes | as the maker's own button does |
|---|---|---|
| live, or waiting for review | `taken_off`, with no live or waiting pull and nothing to fix | Take off |
| a draft, or sent back | `thrown_away`, its address `x-<public id>` so the name is free | Throw away |
| already taken off, taken down or thrown away | unchanged state | |

For every one of the person's games, whatever its state: its files (`files/<public id>/`) and videos (`clips/<public id>/`) are deleted from the bucket, and its video rows (`GameClip`) are deleted. The `Game` rows and their pulls stay, because money, play and statement rows point at them.

## How

All in `src/features/accounts/deletion.ts`, inside `purgeDueAccounts`, the same way the maker's page and photo are removed:

1. Before the database: read the person's games and delete each one's `files/` and `clips/` folders in the bucket. A missing file is not an error. The bucket goes first for the reason the photo does: if it fails, the request is not yet marked done and tomorrow's run tries again; done the other way round, files left behind would have nothing pointing at them.
2. In the per-account transaction, after the maker's page: `takeGamesOff` sets the states above and deletes the person's `GameClip` rows. If the transaction fails, the request stays open and the next run repeats both steps.

The accounts feature writes the `Game` and `GameClip` tables directly (it is below games in the layer order, so it cannot call the games service). It already writes the wishlist and the maker's page the same way.

## What cannot be undone, and why it is acceptable

- The bucket deletes are permanent: R2 keeps no copy. This is the owner's decision. The files can still be pulled from the maker's GitHub repository, but only by the maker, whose account is gone.
- **Videos are deleted, which Take off does not do.** Take off keeps a game's videos so it can be put back. Nobody can put back a deleted person's game. The owner chose this on a card, 2026-11-21 14:58 UTC: "Delete the videos too".
- An account whose deletion was cancelled (signed in within the 14 days) is never touched: the job only reads requests that are due and not cancelled.

## Depends on, and affects

- #269 (everything editable) adds held values on a game that wait for review, and a database rule (`Game_held_check`) they must satisfy. Coordinated with that plan: if this merges first, #269's unit A clears held values in the purge; if #269's unit A merges first, the clearing and its criterion (A11) come into this pull request before it merges. `main` never has both without the clearing.
- No schema change and no migration.

## Acceptance criteria

1. Database test (`tests/features/accounts/purge.pg.test.ts`): after the 14 days, the leaving maker's live and waiting games are `taken_off` with no live or waiting pull; their draft and sent-back games are `thrown_away` at `x-<public id>`; a game already taken off stays so; every one of their games has no files, no videos and no video rows; all five rows remain; another maker's live game, its files, video and video row are untouched. At 13 days nothing has changed. This test fails on the code before the change (shown: "expected live to be taken_off").
2. Journey (`tests/browser/purged-account.test.ts`): a maker with a live game asks to be deleted; during the wait, and after a run of the job before the 14 days are over, `/g/<game>` answers 200; after the 14 days and a run of the job, the game is taken off and `/g/<game>` and `/g/<game>/play` answer 404.
3. The existing purge tests (`purge.pg.test.ts`, `deletion.pg.test.ts`, `purge-job`, `purged-account`) still pass.

## Out of scope

- Telling players or the maker anything: the maker has asked to be deleted, and a game taken off is gone from Ruken as any taken-off game is.
- Money: a deleted maker's earnings and statements are not changed here.
