# Data Contract

This document defines the user-owned data layer and the system-owned workflow layer for `mentor-match`, and the four layers a record about a person falls into.

Paths and ownership are fixed here, and `validate` enforces every file below in code: the fellowship record, the profile, the brief, the pool, the summaries, the recommendation, the researcher registry and the institution registry.

## User Layer

Files with personal data, decisions, or the applicant's own work product. They are never replaced by an automated update and never committed from a user checkout. Applicant workspaces are selected with `--applicant <applicant-id>`; when only one workspace exists, or `config.yml` names a `default_applicant`, the flag may be omitted. Inside a workspace, one folder per fellowship holds what was written for it, selected with `--fellowship <fellowship-id>`; when the workspace has one folder the flag may be omitted, and otherwise the agent asks. IDs are path-safe strings.

| Path | Purpose |
|---|---|
| `config.yml` | `default_applicant`, per-run budgets, the publication window |
| `fellowships/{fellowship-id}.yml` | One fellowship: whether a named host is `required`, `optional` or `none`; what it asks of a host, rule by rule, each rule carrying the page's own words as `quote` beside the paraphrase, with its own `official_url` and `retrieved_at`; and every published host list it has, each with `bounds_pool` saying whether that list is the whole of who may host. The file is named for the `fellowship_id` it carries |
| `applicants/{applicant-id}/profile.yml` | The applicant's own record, serving every fellowship: `applicant_id`, `field` and `career_stage`, and where the applicant gives them, position, institution, country of work, degrees, publications, methods and constraints |
| `applicants/{applicant-id}/{fellowship-id}/` | One application: everything written for the fellowship whose record carries that id, and nothing for another |
| `applicants/{applicant-id}/{fellowship-id}/brief.md` | The project the applicant is proposing to this fellowship, in their own words; the mentor needs, where the agent drafted them, marked as drafted and accepted, with the date |
| `applicants/{applicant-id}/{fellowship-id}/pool/*` | Dated host candidate pools, each with its sources considered, its confirmed host candidates, its discard section, the registry rows the run added, and its budget line |
| `applicants/{applicant-id}/{fellowship-id}/summaries/*` | Dated per-host candidate summaries |
| `applicants/{applicant-id}/{fellowship-id}/recommendations/*` | Dated recommendations with `fit`, `host_strength`, flags, a proposed set, and keep/drop |
| `applicants/{applicant-id}/{fellowship-id}/machine/*` | The machine record of each report above, one `.yml` under the report's own name |
| `.history/` beside any file above | The previous version of a file a write replaced, stamped with the date and time. Never under `registry/` |
| `registry/researchers.yml` | The facts layer: one row per potential host this clone's runs confirmed. Personal data. Never committed, never seeded, never exported |
| `registry/institutions.yml` | Institutions confirmed during a run: identity and official domains |

The folder's name is the join: a folder with no record of its id under `fellowships/` is refused, and every report in it reads that record, that folder's brief and that folder's earlier reports. Both registries are shared by every fellowship in the clone.

Flat `applicants/*.example.*`, `fellowships/*.example.yml`, and `config.example.yml` are setup examples only, and are fictional. Every path a guard is handed is resolved and proved to be inside this repository before it is opened; a path outside it is refused rather than read.

## System Layer

| Path | Purpose |
|---|---|
| `AGENTS.md` | Repository-wide agent policy, including the personal-data boundary in full; `CLAUDE.md` imports it |
| `.agents/skills/*` | The user-invocable router, symlinked into `.claude/skills/` |
| `.agents/skills/mentor-match/references/pool-worker.md` | Shared procedure for reading one eligible unit, sequentially or through a worker |
| `.claude/agents/pool-worker.md`, `.claude/settings.json` | Claude Code's worker wrapper and guard permissions; other agents use their own tools and permissions |
| `modes/*` | Shared policy and one contract per mode |
| `knowledge/vocabulary.json` | Every controlled vocabulary the guards check; dated `source_version` |
| `registry/institutions.seed.yml` | Institution identity and official domains, `ror_id` where known; dated `source_version` |
| `scripts/lib/*`, `scripts/cli/*` | Deterministic Node guards called through a command tool: `doctor`, `validate`, `gate` |
| `scripts/verify/*` | The CI suite: `layout`, `yaml`, `knowledge`, `gate`, `validate`, `generated` |
| `examples/*` | Fictional fixtures, one valid file per kind; each invalid case is an edit to one of them in `scripts/verify/validate.js`, changing exactly one thing |
| `applicants/*.example.*`, `fellowships/*.example.yml`, `config.example.yml` | Setup examples, not live data |
| `package.json` | Metadata and the `verify:*` entry points |

## Nothing Outside This Root

No path in either layer resolves outside the repository root. The rule, what enforces it, and what it costs are `AGENTS.md` → Standalone.

## The Four Layers

Facts about a person, a run's record of looking for people, the prose that describes a person, and the judgement about a person are four different things, stored in four different places. Description is separate from judgement because they are checkable in different ways: a summary of someone's published work can be checked against its sources, and a fit is an opinion about a stranger. In one file the second would read like the first.

| Layer | Where | Holds | Never holds |
|---|---|---|---|
| **Facts** | `registry/researchers.yml` | Identity, institution, unit, role title as published, official page URL, `retrieved_at`, published professional contact address, `availability` with its quote where a page states one, the publication records a summary cites (title, venue, year, authorship position, status, and the identifier, or the page and date where a paper is stated accepted and unpublished), each attributed to the person only when an official page anchors it, and cited-work metrics each stored with the source that produced it and the date. A field read from a linked site carries that site's URL, its date and `linked_from` | Prose, a fit, a judgement, or anything the person or their institution did not publish. The closed field set in `AGENTS.md` is the whole of what may appear |
| **Run record** | `applicants/{id}/{fellowship-id}/pool/*.md`, with its machine record in `machine/` beside it | Which host list or which units were read, by which route, and each one's outcome; for each unit, the host rule it came from; which researchers were confirmed, named in the prose as their page publishes the name and in the machine record by `researcher_key`; discards and unconfirmed host candidates with their reasons, each named as the list or page prints it and carrying the page its reason rests on as `page_url`, because neither has a row; the budget line. The prose links the full URL of every source and of the page every reason rests on, so the reader can open it | A second copy of any fact in the researcher row, apart from the keep reasons' URLs in the prose. The machine record carries none of those |
| **Description** | `applicants/{id}/{fellowship-id}/summaries/*.md`, with its machine record in `machine/` beside it | Agent-authored prose: what this person works on now, read off their own page and their recent record, each claim citing a row field or a paper the row records. The machine record names each summary's row and lists its citations, which `validate` joins to that row; every confirmed host candidate in the pool is summarised or carried; the budget line | A fit, a host-strength call, a metric, a rank, or a comparison between host candidates; a paper the row does not record |
| **Judgement** | `applicants/{id}/{fellowship-id}/recommendations/*.md`, with its machine record in `machine/` beside it | `fit` and `host_strength`, each as `strong`, `plausible`, `weak` or `unclear`, each with its own reasons, evidence basis and citations, which `validate` joins to the row as it does a summary's; constraint flags; the proposed set, each member with the need it covers; the applicant's keep or drop. Every confirmed host candidate the summaries described is judged or carried | A probability, a combined score, a rank, an unsourced reputation claim, or a prediction about the person; a metric cited for a `fit`; an `availability` cited for either axis |

Every machine-record entry above the facts layer names its `researcher_key` and carries only the run fields and the identity labels. `validate` resolves each join and compares the labels, so a row that changed and a report that did not are reported rather than left to disagree quietly.

## One Registry Ships A Seed; The Other Never Will

The institution registry has two halves: `registry/institutions.seed.yml`, which the maintainer refreshes, and `registry/institutions.yml`, which runs append to. A reader takes both as one list; a local row that duplicates a seed row is redundant, not a conflict. The seed is never written by a run; the local file is never written by an upstream refresh.

There is no `registry/researchers.seed.yml` and there will not be. Why, and what that refusal costs, are `AGENTS.md` → Personal Data; `verify:layout` rejects the path outright.

## Reports

Every report is two files under one dated name: the report, in Markdown, in its kind's directory in the fellowship folder, and its machine record, in YAML, under `applicants/{applicant-id}/{fellowship-id}/machine/`. The report is prose in the applicant's language, for the applicant. The record is English throughout — keys, controlled values, short reason strings — because the guards read it, and no guard reads the prose. Every record carries `kind`, `schema_version`, `applicant_id`, `date`, and `inputs`.

A record records the run, not the world. Where a fact already has a home, the record names it rather than copying it: a pool entry carries `researcher_key`, the run fields, and the identity labels, and the facts the page supplied live in the researcher row with that key. Where a record's `inputs` name an earlier report — a summaries record's pool, a recommendation's pool and summaries, a pool's `prior_pools` — they name its machine record in the same folder, because the joins run between records and a report answers one fellowship; the prose links the reports. A report's `inputs.fellowship` is the record the folder is named for, and its `inputs.brief` is that folder's brief.

The report is `{YYYY-MM-DD}-{pool|summaries|recommendation}.md` in the matching directory, its record `machine/{YYYY-MM-DD}-{pool|summaries|recommendation}.yml`, and the record's `date` matches the name. The two pair by name alone: `validate` refuses a report with no record beside it and a record with no report, and `doctor` reads pipeline position off `machine/`. The report ends with one line linking its record, for the reader; no guard reads that line. `doctor` recognises only that form, so a hand-renamed report is reported as ignored rather than silently picked up. A same-day rerun of a mode, or a keep or drop in a recommendation, replaces that day's pair, and both files move into `.history/` beside them first. `doctor` and `validate` read nothing in a `.history/` folder. Written dates are read as strings and never as timestamps, so a date keeps exactly the form it was written in.

## Boundary Rules

- The applicant's profile and brief, the fellowship records, every pool, summary and recommendation with its machine record, and both local registry files are user layer. Policy, vocabularies, the institution seed, mode contracts, and guards are system layer.
- Every write to the user layer follows the guards named in the mode, and the agent points the applicant to the file rather than showing its content. A replaced file the applicant owns keeps its previous version in `.history/`; a registry does not (`AGENTS.md` → User Layer). The deterministic commands write nothing at all; `verify:layout` refuses a write call anywhere under `scripts/`.
- A record about a person holds only the closed field set in `AGENTS.md`.
- What a record may say inside that field set — the metric rule, `availability`, and that nothing stored predicts a person or carries a judgement without its reasons — is `AGENTS.md` → Principles. The **Never holds** column above is the per-layer form of it.
