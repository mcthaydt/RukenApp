# Live state: claude/project-thread-4625xg

- Current task: fix the root causes of the flaky play.test.ts:41 and pay.test.ts:41 (lane 2: tests/browser/support/account.ts is shared by many journeys).
- Last commit: f0ccc09 (2026-11-22 01:33 UTC)
- Next step: lint, typecheck, run the payment journeys locally (computer, tablet), push, open the draft pull request.
- Open decisions: none.

## Plan

- [x] Read both CI logs (runs 44852401580 and 44889391086) and find each cause.
- [x] pay.test.ts:41: `signUpFromTheCard` waits for the card's page to settle before the next goto.
- [x] play.test.ts:41: the stand-in's "Pay" press no longer waits 5 s for the page it starts (`pressPay`); the next look waits for the site's answer.
- [ ] Lint and typecheck.
- [ ] Payment journeys pass locally, repeated (computer, tablet).
- [ ] progress.md "Flaky tests" entries name the causes and fixes.
- [ ] Draft pull request, CI green, lane 2 review PASS, merge.
