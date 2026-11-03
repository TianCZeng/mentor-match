# List Mode

After a pool, `summarize` comes next.

## Purpose

Build the host candidate pool: the people who could host this applicant's project under this fellowship's rules.

This is the mode where the personal-data boundary stops being a paragraph and becomes a file. Every row it appends to `registry/researchers.yml` is personal data about a named person who did not agree to be catalogued. Read `AGENTS.md` → Personal Data before this contract, not after it.

The pool answers who exists and where. It does not describe anyone — that is `summarize` — and it does not judge anyone — that is `recommend`.

## Inputs

- `fellowships/{fellowship-id}.yml`, the record the folder is named for: the host rules, and the published host list's URL where there is one;
- `applicants/{applicant-id}/{fellowship-id}/brief.md` and `applicants/{applicant-id}/profile.yml`;
- `registry/institutions.seed.yml` plus `registry/institutions.yml`, read as one list;
- `registry/researchers.yml`, shared by every fellowship in the clone. A row another run confirmed saves its page opens, and its person is still screened against this fellowship's rules and this brief like anyone else;
- the machine records of the earlier pools in this fellowship's folder, and no other folder's, to dedupe by `researcher_key` and by normalised official URL; `inputs.prior_pools` names them;
- `config.yml`: the budget caps, or `config.example.yml` when the applicant has none. Say which was read.

## May search

The three ordered host candidate sources in `modes/_shared.md` → Host Candidate Sources, and nothing else. One `site:` search per unit when its URL is unknown. A page a plain fetch cannot read may be read through the same site's own data route, and a lab or personal site an official page links to may fill a field the official pages lack; both are in `modes/_shared.md`. Directories, ranking sites and profile aggregators are leads at every source: they may say a unit or a person exists, and may supply no fact about either.

## May write

- `applicants/{applicant-id}/{fellowship-id}/pool/{YYYY-MM-DD}-pool.md`, and its machine record `applicants/{applicant-id}/{fellowship-id}/machine/{YYYY-MM-DD}-pool.yml`
- rows appended to `registry/researchers.yml`
- rows appended to `registry/institutions.yml` through the registry row flow

Each written, checked and pointed to as `modes/_shared.md` → Writing Files says; neither registry keeps a `.history/`. The seed half of the institution registry is never written.

## Guards

- `gate` on every URL in the run, before any fact is taken from the page it serves.
- `validate researchers` on the registry file after the append. Its field set is closed: a key outside it is an error, not an extension. Every page a fact names goes through the full gate; a fact from a linked site carries `linked_from`, which gates `official`, and the site itself must not be blocked. A contact address sits at the institution the row was read from.
- `validate institutions` on `registry/institutions.yml` after a row is appended through the registry row flow.
- `validate pool` on the report or its machine record, which reads the record: both files present, its inputs the folder's record, brief and earlier pools, the researcher join and its labels, the gate on every URL in the record, every published list in the fellowship record reported with its outcome, every entry a list printed accounted for, each unit's host rule matched by its quote, units present exactly when no list bounds the pool, the list-run vocabularies, the page on every discard and every unconfirmed entry, and the budget line — present, and no stated spend over a `config.yml` cap. The guard cannot see a fetch, so it checks the numbers the run reports against the caps, not against each other.
- `doctor` after the write.

Write `registry/researchers.yml` before the pool, because the pool joins it, and `config.yml` first of all when the applicant has asked to change a cap for this run.

## Output

One dated pool report, in the applicant's language, carrying:

- which source bounded the pool, with its URL and date. Where source 1 applied, the report says the pool is bounded by the fellowship's published list and that such a list can be stale or partial;
- every source read, linked by its full URL, and the route it was read by, linked the same way, where that is not the page a person reads;
- every host-list entry, and every unit considered with the host rule it came from, each with its outcome;
- every confirmed host candidate, named as the page publishes the name (the record carries the `researcher_key`), carrying the run fields, the identity labels and a link to the page its keep reason rests on, no other copy of a fact the researcher row holds, and saying which facts came from a linked site;
- every unconfirmed host candidate with its reason and the page it rests on;
- a discard section in which every removal carries its reason and the page it rests on. A list entry screened out against the brief has no row, so it is named as the list prints it, with the list. `availability` is never a reason: `unknown` never removes anyone, and `stated_closed` is a flag the applicant decides on;
- **Rows added**: every row this run appended to either registry, the people by name and each institution with the domains it admits and the tie it rests on (`modes/_shared.md` → Registry row flow), so the applicant can remove one;
- a **Gaps** section;
- the budget line: web searches and page opens spent against the caps, and the number of host candidates carried to the next run.

Every entry, kept, unconfirmed or discarded, is one line, and the name is the link to the page the line rests on:

```markdown
- [Jonas Pell](https://www.example.edu/people/jonas-pell) — the page states the group studies polymer electrolytes for batteries; none of the brief's needs.
```

A linked site keeps its second link after the name: `(lab site, linked from the [Affiliate Faculty list](…))`. Where a section's page is always the same kind, the section says so once and the lines drop "the page states"; elsewhere a line says in words which page it rests on. A scope note is its own sub-bullet under the entry. Discards that share a reason and a page — entries a list line alone rules out — go in one paragraph under that reason, each named with the detail its own reason adds, and the page linked once.

## The closed field set

`registry/researchers.yml` holds exactly the fields listed in `AGENTS.md` → Personal Data and nothing else. `validate researchers` enforces it, and rejects any key outside the set.

Two of those fields have a shape every write must satisfy, under `AGENTS.md` → Principles. `availability` is three-valued: `stated_open` and `stated_closed` each carry a verbatim quote from the page, the URL and the date read, and `unknown` is the default and the normal case. A metric field carries the name of the source that produced the number and the date it was read, or it is not recorded.

A page publishes more than the set, and the rest stays on the page. An institutional profile page often publishes the person's pronouns, which fall under gender in the never-recorded list. A linked site publishes more still.

## Fan-out

Source 2 can run sequentially in the main session or, when the agent supports delegation, through the shared procedure at `.agents/skills/mentor-match/references/pool-worker.md`. A published host list is one page and needs no worker. Claude Code has a wrapper at `.claude/agents/pool-worker.md`; other agents pass the shared procedure to their own workers. No named worker configuration is required for sequential work.

Prepend the language rules from `modes/_shared.md` and `AGENTS.md` → Personal Data, including the closed field set and linked-site terms, verbatim to every worker prompt. Do not depend on context inheritance. Assign disjoint units and budget shares within the run's remaining caps; include every worker's spend in the total. Workers return findings and never write files. The caller validates the rows and pool it writes, whatever the worker returned.

## Rules a run meets

- **A person, not a page, is screened.** Screen a list entry on the list line where the line alone rules the person out — a law school, a dental school, a non-faculty title against a faculty rule. Otherwise open the page the list links and screen on what it states. A discard carries `rests_on`: the list line, the person's own page, or a host rule.
- **An entry that cannot be screened is kept as `unconfirmed`, never discarded**. A role title alone does not rule someone out.
- **Try a second official page before giving up.** A university's servers may answer a plain fetch with an access-denied page, and many first pages state a role but not the work. A department directory, a research-centre directory or the lab's own page on the institution's domain usually has it. Count each page as an open.
- **Try `https://` for a list's `http://` link.** The gate blocks `http`; the same site usually serves both. A redirect to another domain is gated as its own URL.
- **Look inside a page before calling it a gap.** A profile system that renders by script may carry the profile as JSON in the page itself, in a script variable, which is the site's own data.
- **An affiliate's row may stand on the list line.** Where a list links a name to an off-domain lab site, the list line is the row's official page for name, role title and unit, and the lab site is a linked site with the list page as `linked_from`. Where the list links an official page, that page is the row's.
- **Keep the page's form, even when it is wrong.** A name, a unit and a role title are recorded as the official page prints them — where a page prints a first name misspelt, the row keeps it, with a line in Gaps and `[sic]` where the prose prints it. A title on the person's own site that differs from the list line is a scope note, not an edit.
- **No pronoun about a person, anywhere the tool writes.** A keep reason, a discard reason, a scope note and a gap say "the page", "the lab", "the profile". A research statement is a verbatim quote, so choose a sentence from the page that carries no pronoun where one exists; a pronoun is gender, which is never recorded.
- **People on a unit page are opened only if their line could host.** Nobody never opened is recorded or named. Everyone the run opened and did not keep gets a discard line, so the reader can see the screen's mistakes. Where a unit page lists names with no titles or topics, say which names were opened and why; choosing from general knowledge of a field is `inferred`, and the report says so.
- **A stated opening is about a fellow, or it is not availability.** A lab recruiting PhD students says nothing about hosting a fellow; `availability` stays `unknown`.
- **Every page the report rests on is linked by its full URL**, as `_shared.md` → Report Conventions says. The reader checks a line by opening its page, and "its HTML page", "the page states" or a path without its host cannot be opened. The Sources table gives each source's page and, where a data route was read, the route. Each entry's name links the page its reason rests on and, for a linked site, the page that links to it follows (Output, above). The link is for the reader; the machine record still names the row and copies none of it. A discard's prose says in words what its reason rests on; `rests_on` is the record's, and a reason several discards share is written out once, with the discards under it. A discard and an unconfirmed entry have no row, so each carries its page in the record as `page_url`, and `linked_from` for a linked site: the list's or unit's own page for a reason on the list line, the person's page otherwise, and for an unconfirmed entry the page that would not open or stated only a role. Where a redirect served the content, record the URL that served it. A page opened and not recorded is reported as not recorded, never rebuilt from a pattern.
