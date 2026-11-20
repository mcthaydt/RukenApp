Your context was just compacted. Read this before you do anything else.

1. The rules file beats the summary. Where CLAUDE.md or a skill in .claude/skills/ says one thing and the summary says another, CLAUDE.md and the skill win. The summary is someone's note about the rules, not the rules.
2. Re-read CLAUDE.md and docs/superpowers/progress.md now, before your next step. Open the skill in .claude/skills/ whose description fits the work you are in.
3. Your live state is in docs/superpowers/live/<your branch>.md, with "/" in the branch name written as "-" (the branch is `git branch --show-current`): your task, your last commit, your next step and your open decisions. An audit session keeps it at the top of its audit file. Where the summary and that file differ, the file wins. If it is behind what you did, update it and commit it first. The coordinator's live state is progress.md.
4. Do not carry this session into the next big job. A spec, a plan, a pull request's build and an audit each run in a fresh session. When your job is done, commit, report and stop.
