---
name: mentor-match
description: Find a mentor or host for a fellowship or programme -- record what the fellowship asks of a host and what you are proposing, list the people who could host you from official pages, summarize what each of them works on with every claim sourced, and recommend who to write to with fit and host strength judged separately
license: MIT
---

# mentor-match Router

> `doctor` says which modes and guards exist; run it rather than assume. Never stand in for a missing guard and never improvise a mode.

## Invocation

Read the mode, official URL, and optional `--applicant <id>` and `--fellowship <id>` selectors from the user's request. Native skill invocation and plain language are equivalent: "Use mentor-match in brief mode" selects `brief`. With no mode or URL, report the pipeline position. The README gives native invocation examples for individual agents.

Before running a mode, check `modes/_shared.md` → Agent capabilities. A missing tool is a capability limit; `doctor` still decides what is built.

## Output Language

Three rules; none has a configuration key.

**Chat is the applicant's language**, from your first sentence onward: progress narration, preambles, plans, findings, and questions included. A mixed turn follows the applicant's own prose, not the command scaffold or the flags. A bare command in a fresh session carries no prose: before your first sentence, read the selected fellowship's `brief.md`, or the brief written last when none is selected, and use its language. With no brief, English until the applicant writes.

**Report prose is the applicant's language; machine records and registry rows are English**, because the guards read them. Each report has its machine record under the same name in `machine/`; write the two together. A person's name, their unit and their role title keep the form the page published them in.

**Write plainly.** The shortest word that is still exact; a thing said once; no adjective that carries no fact; a reason is a fact and what follows from it, never a verdict restated. The full rule, with its examples and the jargon test, is `modes/_shared.md` → Language.

- **Subagents.** Prepend all three rules verbatim to every worker prompt. Do not depend on context inheritance.
- **Diagnostics.** Machine output from `node scripts/*` stays English in logs and quoted error text; restate it in the applicant's language when explaining.

## What This Tool Refuses

Read `AGENTS.md` → Personal Data before running any mode that touches a person, which is all of them but `brief`. The short form, which is not a substitute for that section:

- a record holds only what the person or their institution published about their professional role and work, from a closed field set;
- no photograph, no demographic, no social account, no personal contact route, no fact about a private life, and nobody who is not a potential host for this fellowship;
- no claim about what someone published without an identifier and a date;
- no metric without its source and its date, and no metric as a reason for a `fit` value;
- no guess about whether a person is available or would accept;
- no combined score, no rank, no probability.

## Session Start

1. Run `node scripts/cli/doctor.js [--applicant <id>] [--fellowship <id>] --json` and read the result. Every decision below comes from that output; nothing is inferred from the contents of a report.
2. Say which config file `doctor` read (`config.yml`, or `config.example.yml` when the applicant has no config of their own).
3. If any entry in `validation[]` is not `ok`, say so first, name the fields, and offer to fix that file before anything else. A failing file is the next step, whatever the pipeline position says.
4. When `applications[]` holds more than one fellowship and none is selected, say where each stands, from its `next_step_reason`, and ask which one this session is for.
5. When `modes[]` shows `brief` incomplete, enter `brief` in conversation before anything else. `missing[]` says which of the three files it lacks.

## Applicant Selection

Every mode that reads or writes applicant state uses `applicants/{applicant-id}/`. `--applicant <id>` selects it. When the flag is absent: the only existing workspace is used; otherwise `config.yml` `default_applicant`; otherwise ask.

Inside it, the profile serves every fellowship, and each fellowship has its own folder, `applicants/{applicant-id}/{fellowship-id}/`, holding the brief and every report for it. `--fellowship <id>` selects the folder. When the flag is absent: the only folder is used; otherwise ask. `brief` for a new fellowship makes a new folder and leaves the others alone.

## Mode Routing

Determine the mode from the user's request:

| Input | Mode |
|---|---|
| empty | pipeline position |
| `brief` | `brief` |
| `list` | `list` |
| `summarize` | `summarize` |
| `recommend` | `recommend` |
| an official URL for a person's page | `list`, single-URL path |
| anything else containing a URL | `list`, single-URL path, after saying what was assumed |

All four modes run, the single-URL path included. `doctor`'s `modes[].built` is what decides, not this paragraph: for a mode it reports as not built, say which mode the input resolves to, say it is not built, and stop.

## Pipeline Position

With no argument, print where the applicant is and the next step, from `doctor`'s output. `doctor` renders it; print what it returns rather than composing it. A mode whose guard is not installed is shown as `not built yet`, never as the next step. Then show the menu:

```text
Ask mentor-match for:
  brief          Record what the fellowship asks of a host, and what you are proposing
  list           Build the pool of people who could host you
  summarize      Say what each host candidate works on, with every claim sourced
  recommend      Judge fit and host strength separately, with reasons; keep or drop
  <official URL> Add one person from their own page
```

Mark any mode `doctor` reports as not built yet, so the applicant is not offered something that will stop. In this release all four run. `doctor` names the next mode in its reason even when that mode is not built, so the applicant is told what comes next and why it will not run yet.

## Guards

Run these through the agent's terminal or command tool from the repository root; they are deterministic and offline. They reject bad input and never rewrite it, so a failure is something to fix in what you authored, not something to work around.

| Command | Use | State |
|---|---|---|
| `node scripts/cli/doctor.js [--applicant <id>] [--fellowship <id>] [--json]` | Session start, and after any write | installed |
| `node scripts/cli/validate.js <kind> <file>` | On every file you write, before the applicant is pointed to it. Exit 0 clean, 1 with a list of problems naming their fields | installed for `fellowship`, `profile`, `brief`, `pool`, `summaries`, `recommendation`, `researchers`, `institutions` |
| `node scripts/cli/gate.js <url> [--institution "<name>"] [--json]` | Before treating any page as a source of facts. Exit 0 `official`, 3 `needs_registry_row`, 1 `blocked` | installed |

Write a file, validate it, fix it until it is clean, then point the applicant to it: the path, a few lines, what to read first (`modes/_shared.md` → Writing Files). Never paste a file's content into chat, and never ask a yes before a write; an instruction the applicant types is the yes. When a mode names a guard that does not exist, stop and say which mode is not built. Never substitute your own judgement for a guard's.

## Context Loading

For every mode, read:

- `AGENTS.md`
- `DATA_CONTRACT.md`
- `modes/_shared.md`
- `modes/{mode}.md`

Then the inputs the mode names. Execute the mode's contract. Run the guards it names on every file it writes and fix what they report before pointing the applicant to it; stop on a missing guard.

## Budgets

`list` reads the caps from `config.yml`, keeps a running count of distinct web searches and page opens including any worker's spend, stops at the cap, writes what is unopened as host candidates for the next run, and ends the report with the budget line. `summarize` does the same with bibliographic fetches as a third cap, and carries any host candidate it did not reach. `recommend` opens nothing by default, and ends its report with the page opens it spent.
