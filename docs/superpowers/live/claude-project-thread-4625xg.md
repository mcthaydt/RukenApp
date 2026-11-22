# Live state: claude/project-thread-4625xg

- Current task: fix the root causes of the flaky play.test.ts:41 and pay.test.ts:41 (lane 2: tests/browser/support/account.ts is shared by many journeys).
- Last commit: fdba697 (2026-11-22 01:40 UTC)
- Next step: open the draft pull request (body in project files pr-drafts/flaky-pay-play-pr-body.md) once a pull request place is free; the hook refused at 3 open (#209, #285, #288).
- Open decisions: none.

## Plan

- [x] Read both CI logs (runs 44852401580 and 44889391086) and find each cause.
- [x] pay.test.ts:41: `signUpFromTheCard` waits for the card's page to settle before the next goto.
- [x] play.test.ts:41: the stand-in's "Pay" press no longer waits 5 s for the page it starts (`pressPay`); the next look waits for the site's answer.
- [x] Lint and typecheck.
- [x] Payment journeys pass locally, repeated (computer, tablet): 162 passed. Old code fails with the stand-in held 6 s; new passes.
- [x] progress.md "Flaky tests" entries name the causes and fixes.
- [ ] Draft pull request, CI green, lane 2 review PASS, merge.
