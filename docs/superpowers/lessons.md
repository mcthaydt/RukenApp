# Lessons

One line per lesson, added by the fix session when its fix is accepted (see "Lessons" in CLAUDE.md). Each line is a rule for how later work is split or briefed, with the date and the pull request it came from. The coordinator reads this file before writing a brief. A lesson that keeps coming back moves into CLAUDE.md in the daily rules batch and is removed here.

- 2026-11-16 (#147): A screen test that only names a box ("div.screen is cut off") does not say which child is too wide, so the brief tells the fix session to push a throwaway probe that lists the children past the edge, read it in CI, then remove it, and the test itself should name the child.
