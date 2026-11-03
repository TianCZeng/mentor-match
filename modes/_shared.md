# Shared mentor-match Policy

Reusable policy for every mode. Applicant-specific data lives in the selected workspace, `applicants/{applicant-id}/`, and in its folder for the fellowship being worked on, `applicants/{applicant-id}/{fellowship-id}/`; never here.

`doctor` says what is built: its `validate_kinds[]` and `modes[].built`. When a rule below names a guard or a kind that does not exist, stop and tell the applicant which mode is not built yet. Never stand in for a guard with prose, and never assume a guard exists; run `doctor` and read what it says.

## Rules

The rules every mode follows are `AGENTS.md`'s — the ten Principles, Personal Data, Sources and Trust, and The Two Judgement Axes — and they are stated there once. A rule stated twice is a rule that can drift, so this file does not restate them. It adds how a mode carries them out: the language rules, the host candidate sources and the registry row flow, scope handling, how a file is written, what a report contains, and the guards.

One operating rule sits above the rest. Run the guards the mode names on the exact file you wrote, and fix it until they pass, before the applicant is pointed to it; stop on a missing guard. A rejection is something to fix in what you authored, not something to work around.

## Agent capabilities

Use the tools your agent provides for local file reads and writes, command execution, web search, and page or bibliographic retrieval. Run Node commands from the repository root. Skill discovery and subagents are optional: the router can be read as a file, and `list` can read units sequentially.

Before starting, confirm that the tools needed for the requested mode are available. If a guard cannot be executed, stop and name the missing capability; never replace its result with prose. If a source cannot be read with the required URL and redirect checks below, report the gap under that mode's rules. Do not describe an installed mode as unbuilt because your agent lacks a tool.

Use the agent's question tool when available, or ask in chat. A missing question tool never supplies an answer. Permissions and sandbox settings belong to the agent running the session; `.claude/settings.json` configures Claude Code only. Neither a permission prompt nor its absence replaces the domain gate or the source rules.

Count searches, page opens and bibliographic requests individually, including work delegated to other agents. A tool call containing several requests spends the budget for each request, not one for the batch.

## Language

Three rules; none has a configuration key.

**Chat is the applicant's language**, from your first sentence onward, including progress narration and questions. A turn that mixes a command scaffold with one sentence of the applicant's prose follows that prose. A session opened by a bare command in a fresh session has no prose to follow: before your first sentence, read the selected fellowship's `brief.md`, or the brief written last when none is selected, and use its language, because the brief is the applicant's own words. With no brief, use English until the applicant writes. Once they write, their prose decides.

**Report prose is the applicant's language; machine records and registry rows are English.** Pools, summaries and recommendations are read by the applicant, so their prose is in the applicant's language, found as for chat. Each report's machine record is English throughout, because the guards read it; the guard rejects Han, Kana, and Hangul script in the tool's own words there. A person's name, their unit name, and their role title keep the form the page published them in, in every language, and are never translated or transliterated.

**Write plainly.** Use the shortest word that is still exact, and say a thing once.

- No mannered prose: no rhetorical questions, no preamble before the answer, no "it is worth noting", no metaphor standing in for a reason.
- No adjective that carries no fact. `excellent researcher`, `impressive record`, `exciting group`, `strong publication history` say nothing the evidence line does not. A `fit` is `strong` because the rubric says so, and the reason beside it is why.
- Jargon only where it is this tool's fixed vocabulary (`fit`, `host_strength`, `official`, `linked`, `bibliographic`, `inferred`, `needs_registry_row`, `stated_open`, `stated_closed`) or the page's own word for something. Gloss a term only when this reader would not already know it. A postdoc applicant knows what a PI, a corresponding author and a preprint are; explaining them is the padding this rule exists to stop. Gloss what is genuinely opaque: a tool-internal word like `needs_registry_row`, or a term one country's system uses and another's does not.
- A word the tool made up for its own files is not report prose. Say what it means instead: "what the tool recorded" for a registry row, "left for the next run" for carried, the years for the window, "the index's author profile mixes in another person's papers" for a mixed profile, and a flag or a `rests_on` value by what it says. The machine record keeps the word.
- Name a person as their page publishes the name: in full at the first mention in a section, by surname after, and in full wherever two people share a surname. A `researcher_key` belongs to the machine record and never appears in prose or a heading. A name the page misprints keeps the printed form, marked once per section as `[sic]`, so the applicant does not copy it into a letter.
- Name a fellowship rule, never number it. The reader does not have the fellowship record open, so "rule 1" says nothing. Quote the rule once with its page, give it a short name, and use that name after.
- A reason is a fact and what follows from it, not a verdict restated. "Three first-author papers on spiking network models since 2023, and the brief proposes a spiking model of the same circuit" is a reason; "clear research alignment" is not.

Prepend these three rules verbatim to every subagent prompt; do not depend on context inheritance.

## Sources and Trust

The five tiers — Official, Linked, Bibliographic, Inferred, Leads — and what each one is allowed to establish are `AGENTS.md` → Sources and Trust. Neither axis is `strong` on `inferred` alone.

## Host Candidate Sources

A `list` run works through three sources in order, after deduping against the earlier pools in the same fellowship folder by `researcher_key` and by normalised official URL — a person's own page, not a list page, which many rows share (`modes/list.md`). A pool for another fellowship is not read: its people were screened against other rules and another brief.

| Order | Source | Cost | Rule |
|---|---|---|---|
| 1 | Each published host list the fellowship record carries, on the fellowship's own site | one page open per list, plus one per entry kept | A person on such a list is eligible by publication, so no unit-level eligibility argument is needed, and the list line is an official source for their name, role title and unit. Screen each entry against the brief and the host rules: an entry whose work could host the project is kept and confirmed on their own page; one whose work could not is discarded by the name the list prints, with the list, a reason, and the page that reason rests on, and gets no registry row. Record the list's URL and date, and say in the report which lists bounded the pool and that a published list can be stale or partial |
| 2 | The eligible units' own people or research-group pages | one `site:` search per unit when the URL is unknown, plus the page opens | Read whenever no published list has `bounds_pool: true`. Form the unit list from the host rules and the brief: each unit names the host rule it came from and why it is on the list, and a person already read from a source 1 list is not read twice. Report every unit considered with its outcome; a unit not opened for budget is a gap |
| 3 | A named person's own page | one page open | The single-URL path, for someone the applicant already knows of |

**Source 1 does not always end the run.** Read `bounds_pool` on each entry in the fellowship record's `host_lists`. Where one is `true`, the host rules make that list the whole of who may host and source 2 is not read. Where every entry is `false`, the lists are branches of a wider rule — a fellowship can name its own faculty *and* admit anyone at the university working on the subject — and source 2 is read as well, with the report saying the pool is not bounded by any published list. A record that carries no `host_lists` goes straight to source 2.

**A page a plain fetch cannot read.** A list or people page that renders its names with a script returns nothing to a fetch. Look for the same site's own data route — a WordPress site answers under `/wp-json/`, for one — gate it like any URL, and read the list from it. The fellowship record keeps the page a person reads as `official_url`; the report names the route the run read. Where no route is found the page is a gap with that reason, and a directory or a search result never stands in for it.

**Registry row flow.** For a page a person's facts are read from; a fellowship's own page needs only not to be `blocked`. The gate admits a domain in three ways, in this order: the domain is a known row in the institution registry; or it sits under a **restricted** academic registry (`.edu`, `.ac.uk`, `.edu.au`, `.ac.nz`, `.edu.sg`, `.edu.cn`, `.ac.jp`, `.ac.kr`, `.edu.hk`, `.edu.tw`, `.ac.in`), which admits only educational and research institutions; or it sits under an **open** registry such as `.ca`, which anyone may register, *and* the domain is the institution's own name, so `--institution` must be passed and must account for the domain. Everywhere else the gate returns `needs_registry_row`.

Pass `--institution "<name>"` whenever you have one. On a restricted registry it never lowers the verdict: a domain that does not spell out the name earns a warning, which means the page itself must name the institution before a fact is recorded. On an open registry it decides the verdict, because there the registry guarantees nothing.

On `needs_registry_row`: `gate` prints the row with the domain and the date filled in. Before writing it, find one tie to the domain from outside it, because a copycat or a squatted domain names the institution on its own pages too:

- a page the gate already admits, the fellowship's own page included, links to the domain; or
- the institution's record in the Research Organization Registry (`https://ror.org`) lists the domain, and a page on the domain names the institution. Record the `ror_id` in the row. The ROR read counts as a page open.

A page on the domain that names the institution is not enough alone. Fill the rest of the row, append it to `registry/institutions.yml` with `confirmed_by: agent`, which the template carries, run `validate institutions` on that file, and re-gate the URL. The pool report lists the row with the tie it rests on, because no one read that evidence before the domain began to count as official; if the applicant removes the row, every fact read under it fails `validate researchers`, and `doctor` says so. Where no tie is found, write no row: the unit's people stay unconfirmed with that reason. `blocked` is final: a blocked site is a lead at best, and re-gating it will not change that.

A lab's or a person's own domain never gets a registry row, whatever the gate says: the registry names institutions. Such a site is read only as a linked site.

**Linked sites.** The terms are `AGENTS.md` → Personal Data → Linked sites. In a run: follow the link only from an official page that names the person, and only for a field the official pages lack. Gate both. The linking page must be `official` and is recorded as `linked_from`; the site itself is expected to be `needs_registry_row`, which here is not acted on, and `blocked` means it is not read. Take only the closed field set off it, and say in the report which facts came from a linked site.

**Redirects.** Use a retrieval tool or request option that exposes redirects before following them. Gate a target on another domain before fetching it, applying the same Official, Linked or fellowship source rule as for any new URL. Repeat at each cross-domain hop. Automatic redirect following is not a substitute for that check. If the available tools cannot expose the target before fetching it, leave the page unread and report the capability gap. Do not rely on a tool's name to establish how it handles redirects.

Record the URL that served the content with `redirected_from` when it differs. A redirect within the same domain still needs an identity check: read the page title and any sentence saying the person has moved or the page has closed. Unwrap search-engine wrapper URLs before gating.

## Scope Handling

A host candidate whose unit the host rules do not cover, who holds no independent position, who has no senior-author output in the window, whose page states it is closed, or who has moved or will move institution is **named, not dropped**: the host candidate stays in the pool with a scope note, and `recommend` turns the note into a constraint flag. A removal goes to the discard section with its reason, and `availability` is never a reason for a removal.

## Writing Files

How a mode carries out principle 8 and `AGENTS.md` → User Layer, for every file it writes: the fellowship record, the profile, the brief, a report pair, and either registry.

1. **Keep what it replaces.** Where the file exists — the profile, a brief, a fellowship record, a same-day report pair, a recommendation the applicant is keeping or dropping from — move it first into `.history/` in its own directory, named for itself with the date and time before the extension: `.history/brief.2026-10-22T153012.md`. A report's two files move together. Neither registry is copied: append to it in place.
2. **Write, then check.** Run the guards the mode names on the file and fix what they report until it is clean. A file the guard still refuses is not handed over: say what is wrong and stop.
3. **Point to it.** Give the path as a link and three to five lines: what it holds, in counts, and the section to read first. Say that the applicant can edit the file or say what to change, and say when an old version moved into `.history/`. Never paste the file, or a section of it, into chat.

An instruction the applicant types — a keep, a drop, a correction, a changed cap — is the yes: carry it out, check it, and point to the result. A question whose answer the mode needs is still asked; a question that only asks leave to write is not.

## Report Conventions

The file form — a dated Markdown report, its machine record under the same name in the fellowship folder's `machine/`, and the record's required keys — is `DATA_CONTRACT.md` → Reports. Write the two together, and validate either one: the guard reads the record and refuses a pair with a half missing. What a report must contain beyond that form:

- it says what it read (the record's `inputs`, restated) in a line or two: first in a pool or a summaries report, and after the answer in a recommendation, which opens with the proposed set;
- it shows the reasons beside every judgement;
- every page it rests on is a Markdown link whose target is the full URL and whose label says what the page is, `[Fellowship page](…)` or `[Nature Communications 2026](https://doi.org/…)`, so the reader can open it and read the sentence without reading an address. In a pool entry the label is the person's name, and the reason says in words which page it rests on;
- it has a **Gaps** section that is never empty when something was unresolved: a unit not opened, a domain the gate could not resolve, a page that would not open, a record that could not be established, an `availability` nobody stated. A gap is written once, in the report of the run that met it: a later report names its own gaps and links back to the earlier report's Gaps for the rest, and a gap a later call rests on is still named beside that call;
- its prose names each person by name (Language, above), its machine record names them by `researcher_key` beside that name, and it carries no second copy of any other fact the researcher row holds. The exceptions are a discarded entry and an unconfirmed host candidate, which have no row: each is named as the list or page prints it and carries the page its reason rests on;
- a `list` report lists every source considered with its outcome and the route it was read by, keeps a discard section, says which facts came from a linked site, lists the registry rows it added, and ends with the budget line; a `summarize` report and a `recommend` report end with it too;
- where the profile lacks a field the mode reads, its Gaps say what that cost: a flag `recommend` could not raise, or a summary that could not say what touches the applicant's own papers;
- its last line links its machine record, for the reader only, as `Machine record: [../machine/2026-09-23-pool.yml](../machine/2026-09-23-pool.yml)`. No guard reads the line; the pair is matched by name.

## Guard Invocation

Guards are deterministic Node commands run through a command tool. None reaches the network.

| Guard | Checks | State |
|---|---|---|
| `node scripts/cli/doctor.js [--applicant <id>] [--fellowship <id>] [--json]` | Workspace health and pipeline position on the first message of a session; re-validates every file it finds, in every fellowship folder; reports each application with its next step; derives `next_step` from a fixed table over file existence and the `host_requirement` a fellowship record states, never from report prose | installed |
| `node scripts/cli/validate.js <kind> <file>` | Schema and controlled vocabulary (`knowledge/vocabulary.json`); required fields; id shape; banned claims and the English-script check, each on the keys a kind writes in the tool's own words and never on a field copied from a page; the gate on every URL a record carries, where a fellowship's own page is refused only when the gate blocks it; the identifier shape on every publication a record cites; the joins between the four layers, and each judgement's citations joined to the row it names; for a report, handed over as either file, that its machine record and the report both exist; for a file in a fellowship folder, that `fellowships/` holds a record of the folder's id, and that a report's inputs are that record and that folder's files. Exit 0 clean, 1 with a list of problems naming their fields | installed for `fellowship`, `profile`, `brief`, `pool`, `summaries`, `recommendation`, `researchers`, `institutions` |
| `node scripts/cli/gate.js <url> [--institution "<name>"]` | `official`, `needs_registry_row`, or `blocked`, with a reason and warnings. Exit 0, 3, 1 | installed |
| `npm run verify` | The CI suite: `verify:{layout,yaml,knowledge,gate,validate,generated}` | installed |

`doctor`'s `validate_kinds[]` and `modes[].built` are the live answer to what exists, and this table is only the description. A kind `validate` does not know is a mode that is not built, and the mode stops rather than writing an unchecked file. A path outside this repository is refused by every command that takes one; nothing routes around that.
