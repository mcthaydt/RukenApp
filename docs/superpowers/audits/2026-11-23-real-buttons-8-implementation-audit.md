# Real buttons: implementation audit, round 8 (wording change only)

- PR: #345
- Head examined: `f08e9da349d7acd04e053e3235d92dfb9e020f14` (one commit on the round 7 PASS head `00abe4e`)
- Reviewer: the same session as round 7, Opus 5.5, medium
- Date: 2026-11-23 22:21 UTC
- Verdict: **PASS**

## Scope

`git diff 00abe4e f08e9da` touches two files:

- `src/features/consent/Notice.svelte`: the cookie notice's first paragraph, changed the same way in both copies (the glass notice and the full-page card). "To sign you in, let you play and thank the maker who sent you, Ruken keeps a few small things in your browser. We keep nothing until you say yes." now reads "We save a few small things in your browser. They keep you signed in, let you play and thank the maker who sent you. Nothing is saved until you say yes."
- `docs/superpowers/progress.md`: one new line on the flaky list, for `real-buttons.test.ts:168` [tablet], "no code waiting".

## Checks

- The words are shorter and plainer, and they say the same things: what is saved, why, and that nothing is saved before yes. They pass the drunk-grandma test.
- No journey or unit test quotes the old words. The `cookie-consent` journeys quote only the `WHY` lines ("To sign in, Ruken needs to keep…"), and those are unchanged.
- The cookie journeys (`cookie-consent.test.ts`, plus the cookie tests in `real-buttons.test.ts`) on computer and tablet: 22 passed. The consent unit tests: 66 passed. prettier is clean on both files.
- Not run here: phone (WebKit). CI covers it.

## Notes (not blocking)

1. When a button opened the card (`/cookies?reason=…`), the `WHY` line ("To sign in, Ruken needs to keep a few small things in your browser.") now sits right above "We save a few small things in your browser." That is two lines in a row about "a few small things". Main had the same repeat with the old words.
2. `docs/superpowers/specs/2026-11-22-cookie-consent-design.md:99` still quotes the old paragraph. The spec records the decision as it was; it should be updated only if the team keeps the spec word for word with the screen.
