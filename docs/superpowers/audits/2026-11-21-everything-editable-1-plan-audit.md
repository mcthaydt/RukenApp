# Plan audit 1: everything is editable

Examined: `docs/superpowers/specs/2026-11-21-everything-editable-design.md` at **f6d9167** (branch `claude/project-thread-kjfg1t`, draft PR #269), read against the code at the same commit (`main` 583661f plus the spec). Lane 3 plan audit, Opus 5.5 medium. Graphify was not used: grep over the checkout at this exact commit answered every question.

**Verdict: f6d9167 FAIL: 6 red, 8 notes.**

The direction is right and matches the owner's words: sections 0 to 3 quote the owner correctly, every "Locked" row in section 2 was checked against the code and is true, and the records in section 3 are each held by an append-only trigger today (`MembershipPayment`, `MembershipStart`, the ledger and statement tables, `PlayPass`, `PlaySession`, `PlayBeat`, `MakerAgreement`, `GameReview`, `GameReviewPart`, `DecisionDay`, `DecisionOutcome`). Unit B's decision-day claim holds: `lapsed()` (`src/features/games/service.ts:219`) is true for any game not `waiting`, so a thrown-away waiting game's held yes lapses and `seatsTaken` frees its seat. The reds are in units A, C and D.

## Red findings

### R1. Held clip keys cannot be served

- UNIT: 5.1, "Held values", key form; criteria A1, A2, A4.
- VERDICT: red.
- REQUIREMENT: 5.1 "When staff say yes, players see the change"; A1 "`/g/<game>` serves the new video".
- REASON: the spec's held key `clips/<publicId>/held-<shape>-<16 hex>.<ext>` is refused by the media gate, so the maker's preview, staff's look and, after the yes, the live video all fail to load.
- EVIDENCE: `src/features/play/gate.ts:44` serves a clip only for `^clips\/[a-z2-7]{10}\/(?:upright|wide)-[0-9a-f]{16}\.(?:mp4|webm|mov)$` ("Nothing else is served as a clip"). The accept in 5.1 points `GameClip.key` at the held key, which this pattern refuses. `gate.ts` is not in unit A's files (section 6), so G6 also forbids the fix there. The spec also lists only `mp4|webm`; clips today may be `.mov` (`clips.ts:21`).
- EXPECTED: a held clip is stored under a key the gate already serves, and the accept moves no file.
- FIX: in 5.1, make held keys exactly `clipKeyFor(publicId, shape, random16Hex, contentType)` (the random part already makes them unguessable and distinct from the live one), with `.mov` allowed. Drop "in the form of `GameClip`'s" as a DB CHECK reference or write that CHECK out (see N1). Spec text only.

### R2. Changing only the content marks of a live 18+ game breaks the held check

- UNIT: 5.1, `Game_held_check` and "Saving"; criterion A3, A6.
- VERDICT: red.
- REQUIREMENT: 1, "Anything a person made, that person can change"; owner 14:28 "Everything, reviewed first" (rating and marks).
- REASON: on a live game already 18+, a maker who changes only the marks gets a held rating equal to the live one, which 5.1 says is "dropped, not kept"; the check then refuses `heldContentMarks` without `heldAgeRating = age_18`. The marks question also guards on the live rating, so a held move to 18+ cannot reach it.
- EVIDENCE: 5.1 CHECK: "`heldContentMarks` is empty unless `heldAgeRating` is `age_18`"; 5.1 Saving: "A held value equal to the live one is dropped". `saveAnswer` case `marks` (`service.ts`, "This question is only for games that are 18+") reads `game.ageRating`, the live value.
- EXPECTED: the rating and marks are held as one value: either both are held or neither.
- FIX: in 5.1, say a held rating change always holds the pair (`heldAgeRating` set whenever `heldContentMarks` changes, even when equal to the live rating, and "dropped" only when both equal the live pair); the marks question reads the held rating when there is one. Add to A3: a journey changing only the marks of a live 18+ game, and to A6 a pg case for it.

### R3. A change made after staff's look reaches players without being seen

- UNIT: 5.1 "Sending" and "Yes"; criteria A1, A4.
- VERDICT: red.
- REQUIREMENT: owner 14:28 "staff check the change before players see it"; 1, "the maker makes it, staff say yes, then players see it".
- REASON: the accept copies whatever is held at the moment of the yes. A maker who replaces the held video or rating after pressing "Send for review" (5.1 keeps the question open on a live game with a change waiting) gets the new value accepted unseen.
- EVIDENCE: `accept` (`service.ts`) takes only `gameId` and `staffUserId`; `/jobs/review` `accept` (`src/routes/jobs/review/+server.ts:98`) passes no token of what was looked at; 5.1 copies held values "in the transaction that moves `livePullId`".
- EXPECTED: what goes live is what staff looked at.
- FIX: in 5.1, pick one and add a pg test to A7: (a) saving or dropping a held part while an update waits withdraws the send (Live shows "Not sent yet" and "Send for review" again), or (b) `look` answers the game's `changedAt` and `accept` refuses with CONFLICT ("It changed since you looked. Look again.") when it has moved. Recommendation: (a), it needs no change to staff's command. Spec text and A's own files only.

### R4. The account purge does not touch games, so A8 cannot pass and the owner's 14:26 decision is unplaced

- UNIT: 5.1 "Leaving"; section 6 unit A's files ("the purge of a game's clips … called by the account purge"); criterion A8.
- VERDICT: red.
- REQUIREMENT: G6 (files in the unit's row only); owner 2026-11-21 14:26 UTC card "Games come off with the account".
- REASON: there is no purge of a game's clips today. `purgeDueAccounts` leaves every game as it is, so "purging its maker's account leave[s] no `GameHeldClip` row" needs new purge code in `src/features/accounts/deletion.ts`, which is not in A's files. The spec never mentions the owner's decision that a purged maker's games come off Ruken, though it is the "delete" half of this spec's own outcome.
- EVIDENCE: `src/features/accounts/deletion.ts:103-160` deletes sessions, accounts, installations, wishlist, page and verifications, and updates the user; no `game` call. Memory of 14:26: "Not built yet (purgeDueAccounts leaves games)".
- EXPECTED: the spec says which unit (or which other thread) makes the purge take a maker's games off, and A8's purge half depends on it.
- FIX: in 5.1 and section 6, either (a) give unit A the owner's decision (purge calls `takeOff` for each live game, which clears held values) and add `src/features/accounts/deletion.ts` to its files with a journey, or (b) name the thread that builds it, make A8's purge case wait on it, and list it in section 7. Spec text only.

### R5. Unit C reopens an owner-approved decision without asking

- UNIT: 5.3 and its row in section 6.
- VERDICT: red.
- REQUIREMENT: CLAUDE.md "A decision the owner has made is not reopened; if new facts make it look wrong, say so once, with the facts", and "Product choices … Ask each choice as a decision card"; "silence never creates a new approval".
- REASON: the frozen address came with the owner's "B" of 2026-11-14 (live name changes), and the screen promises it; the spec makes the opposite a "Call" the owner "can strike". The owner asked for things a person made to be changeable, not for the address to move, so this is a product choice to ask, not to build by default. The screen words that promise the old behaviour are not in C's changes either.
- EVIDENCE: `docs/superpowers/specs/2026-11-14-maker-screens-redesign-design.md:232` ("Owner, 2026-11-14: 'B' … 'Its address on Ruken stays the same, so links you've shared keep working.'"); `src/routes/make/[game]/[question=question]/+page.svelte:44` (`ADDRESS_STAYS`); `service.ts` case `name` comment "after that it never moves". Section 7 of the spec does not list C as an open decision.
- EXPECTED: C is listed as an open product decision, asked once as a decision card with a recommendation; C's build waits on the answer; if it goes ahead, C's changes include the `ADDRESS_STAYS` words and their test.
- FIX: move C under an "Open decisions" heading with the card's question and options (keep the address / move it and forward the old one), mark C "waits on the owner's card" in section 6, and add the screen-words change to 5.3 and C's files. Spec text only.

### R6. A changed email leaves Stripe mailing the old address

- UNIT: 5.4.
- VERDICT: red.
- REQUIREMENT: 1, the outcome; 4, Boundaries (`src/features/membership/` not touched).
- REASON: a member who changes their email keeps receiving receipts and Stripe's mail at the old address, because the Stripe customer is made once with the address of the day. The spec neither handles it nor lists it as waiting.
- EVIDENCE: `src/features/membership/service.ts:89-90` and `checkout.ts:115` (`stripe.customers.create({ email })`); nothing updates it later.
- EXPECTED: the spec says what happens to a member's Stripe address when the email changes.
- FIX: add it to section 7 (waits for slice 5, or the membership owner's unit, with the stated effect until then) and to section 9's risks, or, if the author prefers to fix it, mark D lane 3 (it would touch `src/features/membership/`) and add a criterion. Spec text only.

## Notes (recorded, not blocking)

- **N1.** "CHECK on `GameHeldClip.key` in the form of `GameClip`'s": `GameClip` has no key CHECK in the database; its form lives in `clips.ts:21` and `gate.ts:44`. Write the CHECK out in full.
- **N2.** 5.4 assumes better-auth sends the link to the new address and a notice to the old one. Some versions ask the old address to approve first. Step D1 stops only if a call is "missing or needs a table"; it should also stop and amend the spec if the installed flow differs from 5.4.
- **N3.** The purge clears `verification` rows by the current email and user id (`deletion.ts`); a pending change-email link to the new address may survive a purge. D should check it.
- **N4.** Unit D changes how sign-in credentials are changed. The lane 3 list names "credentials"; the coordinator may want D audited as lane 3. Recorded as a judgement, not a rule break.
- **N5.** A1 and A5 say the old or dropped file's address "answers 404". The gate serves clips `public, max-age=31536000, immutable`, so a browser or edge cache may still show it; the journey checks the gate, which is right, but the claim should say "the gate answers 404".
- **N6.** At audit time no pull request exists for `claude/project-thread-u1uamt` (open PRs: #209, #251, #267, #268, #269, #270). Unit A's wait is real and has no date.
- **N7.** The race in R3 already exists for files (`pullLatest` moves `pendingPullId` while waiting) and for a waiting game's answers. Out of scope here; a follow-up for slice 4.
- **N8.** Six pull requests are open against the Settings limit of 3. Outside this spec; reported for the coordinator.

## What was checked and how

- Every row of section 2 against `src/features/games/service.ts` (`saveClip`, `LIVE_MAY_CHANGE`, `LIVE_MAY_BE_SENT_BACK`, `saveAnswer` case `name`, `throwAway`, `takeOff`, `sendForReview`, `accept`, `sendBack`, `sendOutDecisionDays`, `lapsed`) and `src/routes/make/[game]/[question=question]/+page.server.ts` (`LIVE_MAY_ANSWER`).
- Section 3 against every `CREATE TRIGGER` in `prisma/migrations/`.
- Clip serving: `src/features/play/gate.ts`, `src/features/games/clips.ts`, `src/features/games/services.ts` (`media`).
- Purge: `src/features/accounts/deletion.ts`. Auth: `src/features/accounts/auth.ts`; `package.json` pins better-auth 1.7.7 (not installed in this container, so its change-email flow was not read).
- Standing permission quoted in section 6: present in `docs/superpowers/history.md:19`.
- Not run: no tests or builds (a plan audit changes no code).
