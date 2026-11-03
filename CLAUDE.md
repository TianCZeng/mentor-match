@AGENTS.md

## For Claude Code

The instructions above (`AGENTS.md`) are the single source of truth for product policy. This file only adds Claude Code specific pointers.

- **Skills** live at `.agents/skills/*` and are symlinked into `.claude/skills/`. Each skill is a single file on disk: edit it under `.agents/skills/<skill>/` and the `.claude/skills/` path reflects the change. Never hand-edit both paths or replace a symlink with a real file.
  - `/mentor-match` is the product router (brief, list, summarize, recommend, or a single official URL).
- **Contributing?** Start from `CONTRIBUTING.md`. `npm run verify` must pass. `scripts/verify/layout.js` asserts structure only — files, symlinks, the mode set, the script chain, the user-layer rules, the Claude permissions, that no guard writes, the containment rule — and never documentation wording, so prose changes do not need a matching assertion.
- **Unit worker.** `.claude/agents/pool-worker.md` loads the shared procedure from `.agents/skills/mentor-match/references/pool-worker.md`. Its tool list and turn limit apply only to Claude Code.
