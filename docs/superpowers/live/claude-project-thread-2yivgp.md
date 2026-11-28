# Live state: claude/project-thread-2yivgp

- Current task: root-cause and fix the flaky feed reload journey (feed-controls.test.ts:536 [phone]); check #460's phone failure.
- Last commit: 0e2e3b2 (branch made from main)
- Next step: make the reload journey force the cancelled /followed fetch every run, then ignore only that WebKit line.
- Open decisions: none. Cause found: WebKit logs a cancelled fetch (the Followed page asked for ahead, cut off by the reload) as "Fetch API cannot load … due to access control checks.", and Playwright reports that line as a page error. #460's failure is a different race in tabs-show-now.test.ts:128.
- Updated: 2026-11-28 10:25 UTC
