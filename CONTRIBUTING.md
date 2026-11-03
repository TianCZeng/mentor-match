# Contributing to mentor-match

This is the first public release. All four modes run — `brief`, `list`, `summarize` and `recommend` — and the three guards, `doctor`, `validate` and `gate`, are installed. Open an issue before building anything; the roadmap is still moving and parallel work would collide.

To set up, follow the README's **Quick start**: Node.js 22 or later, git, `npm ci`, and macOS, Linux or WSL. `npm run verify` runs offline and passes on a fresh clone.

## Ground rules

- **Read `AGENTS.md` first, and its Personal Data section before the rest.** This tool builds a local file of named people who did not agree to be catalogued. The field set is closed, the file is never seeded and never committed, and nothing about a private life, a demographic, an appearance, or a personal contact route is ever recorded. A change that widens that boundary will not be merged.
- **Official pages are the source of facts about a person.** A lab or personal site an official page links to may fill a field the official pages lack, and nothing else (`AGENTS.md` → Linked sites). Directories, ranking sites, and profile aggregators are leads. A publication claim carries an identifier. A metric carries the source that produced it and the date. Nothing predicts whether a person will accept.
- **No probabilities, no ranks, no combined scores.** `fit` and `host_strength` are two judgements with their own reasons and their own evidence basis, and neither is `strong` on inference alone.
- **Never include real personal data in a commit.** Committed content must be fictional and labelled as such. `registry/researchers.yml`, `applicants/`, and `fellowships/` are gitignored; keep them that way.
- **Never paste a run's files into a public issue or pull request.** A researcher row, a pool, a summary or a recommendation names real people, and your profile and brief are your own. Describe the problem, or reproduce it with the fictional fixtures in `examples/`. Security problems and personal data exposed by accident are reported privately: see `SECURITY.md`.
- **This repository is standalone.** It reads nothing from another checkout and writes nothing into one. No path under `scripts/` may leave this repository root, and `verify:layout` asserts it.
- **`npm run verify` must pass.** If you change a contract, extend the matching `verify:*` script in the same change, so the invariant is enforced and not only documented.
- **Prose is yours; structure is checked.** `scripts/verify/layout.js` asserts only what code or the harness depends on — which files exist, the skill symlinks, the mode set, the script chain, the user-layer rules, the Claude permissions, that no guard writes, the containment rule. It does not police wording, so write the documents in the clearest way you can.
- **One paragraph per line.** In Markdown, write each paragraph, list item and quoted paragraph on a single line, with no manual line breaks inside it; editors and GitHub wrap it for the reader. A break between two Chinese characters also shows as a stray space.
- **Ported rules carry provenance.** Anything lifted from another project is attributed in `NOTICE`.
- **Build the smallest thing that passes.** No option, field, or module for work that has not started; a helper earns its place when a second caller needs it.
- **Keep shared instructions portable.** Put general policy in `AGENTS.md`, procedures in the skills and modes, and agent-specific settings in their adapters. Shared skill frontmatter uses Agent Skills fields; `verify:yaml` checks it. A native command, question tool or worker is never the only way to enter a workflow that can run through plain instructions.

## Workflow

1. Branch from `main`.
2. Make the change; keep diffs focused.
3. Run `npm run verify` locally.
4. Open a PR describing which invariant or mode the change serves.
